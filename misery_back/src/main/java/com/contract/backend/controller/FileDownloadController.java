package com.contract.backend.controller;

import com.contract.backend.common.Entity.ContractEntity;
import com.contract.backend.common.Entity.ContractVersionEntity;
import com.contract.backend.common.Entity.UserEntity;
import com.contract.backend.common.exception.CustomException;
import com.contract.backend.common.exception.CustomExceptionEnum;
import com.contract.backend.common.repository.ContractPartyRepository;
import com.contract.backend.common.repository.ContractRepository;
import com.contract.backend.common.repository.ContractVersionRepository;
import com.contract.backend.service.AuthService;
import com.contract.backend.service.S3StorageService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@RestController
@RequestMapping("/api/contracts")
@CrossOrigin(origins = "https://localhost:5173", 
             allowedHeaders = "*", 
             allowCredentials = "true",
             methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class FileDownloadController {

    private static final Logger logger = LoggerFactory.getLogger(FileDownloadController.class);

    private final S3Client s3Client;
    private final S3StorageService s3StorageService;
    private final ContractRepository contractRepository;
    private final ContractVersionRepository contractVersionRepository;
    private final ContractPartyRepository contractPartyRepository;
    private final AuthService authService;

    public FileDownloadController(
            S3Client s3Client,
            S3StorageService s3StorageService,
            ContractRepository contractRepository,
            ContractVersionRepository contractVersionRepository,
            ContractPartyRepository contractPartyRepository,
            AuthService authService
    ) {
        this.s3Client = s3Client;
        this.s3StorageService = s3StorageService;
        this.contractRepository = contractRepository;
        this.contractVersionRepository = contractVersionRepository;
        this.contractPartyRepository = contractPartyRepository;
        this.authService = authService;
    }

    @GetMapping("/files/{filePath:.+}")
    public ResponseEntity<byte[]> downloadFile(
            @PathVariable String filePath,
            @AuthenticationPrincipal String userUuid,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // CORS 헤더를 응답에 명시적으로 추가
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Type, Content-Length");

        try {
            logger.info("파일 다운로드 요청 - filePath: {}, userUuid: {}, Origin: {}", 
                filePath, userUuid, request.getHeader("Origin"));

            // 사용자 인증
            UserEntity user = authService.findByUuid(userUuid);

            // 파일 경로로 해당 계약 버전 찾기
            Optional<ContractVersionEntity> versionOpt = contractVersionRepository
                    .findAll()
                    .stream()
                    .filter(v -> v.getFilePath().equals(filePath))
                    .findFirst();

            if (versionOpt.isEmpty()) {
                logger.warn("파일 경로에 해당하는 계약 버전을 찾을 수 없음: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            ContractVersionEntity version = versionOpt.get();
            ContractEntity contract = version.getContract();

            // 권한 검사
            boolean isCreator = contract.getCreatedBy().getUuid().equals(userUuid);
            boolean isParticipant = contractPartyRepository.findByContractAndParty(contract, user).isPresent();

            if (!isCreator && !isParticipant) {
                logger.warn("파일 다운로드 권한 없음 - contractId: {}, userUuid: {}", contract.getId(), userUuid);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            // S3에서 파일 다운로드
            String bucketName = s3StorageService.getBucketName();
            
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filePath)
                    .build();

            try (ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getObjectRequest)) {
                byte[] fileBytes = readAllBytes(s3Object);
                
                HttpHeaders headers = new HttpHeaders();
                
                // CORS 헤더
                headers.set("Access-Control-Allow-Origin", "*");
                headers.set("Access-Control-Allow-Credentials", "true");
                headers.set("Access-Control-Expose-Headers", "Content-Disposition, Content-Type, Content-Length");
                
                // 파일 헤더
                headers.setContentType(MediaType.APPLICATION_PDF);
                headers.setContentLength(fileBytes.length);
                headers.set("Content-Disposition", "inline");
                headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
                headers.set("Pragma", "no-cache");
                headers.set("Expires", "0");

                logger.info("파일 다운로드 성공 - filePath: {}, fileSize: {} bytes", filePath, fileBytes.length);
                
                return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);

            } catch (NoSuchKeyException e) {
                logger.error("S3에서 파일을 찾을 수 없음 - filePath: {}", filePath);
                return ResponseEntity.notFound().build();
            }

        } catch (Exception e) {
            logger.error("파일 다운로드 중 오류 - filePath: {}, error: {}", filePath, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @RequestMapping(value = "/files/**", method = RequestMethod.OPTIONS)
    public ResponseEntity<String> handleOptions(HttpServletRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Access-Control-Allow-Origin", "*");
        headers.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.add("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With");
        headers.add("Access-Control-Allow-Credentials", "true");
        headers.add("Access-Control-Max-Age", "3600");
        
        return new ResponseEntity<>("", headers, HttpStatus.OK);
    }
    // InputStream을 byte[]로 읽는 헬퍼 메소드
    private byte[] readAllBytes(InputStream inputStream) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[8192];
        int bytesRead;
        
        while ((bytesRead = inputStream.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, bytesRead);
        }
        
        return buffer.toByteArray();
    }
}