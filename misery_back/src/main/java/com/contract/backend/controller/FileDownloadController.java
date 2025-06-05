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
// CORS 어노테이션 제거 - SecurityConfig에서 전역으로 처리
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
            HttpServletRequest request
    ) {
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
                throw new CustomException(CustomExceptionEnum.CONTRACT_NOT_FOUND);
            }

            ContractVersionEntity version = versionOpt.get();
            ContractEntity contract = version.getContract();

            // 삭제된 계약서 체크
            if (contract.getDeletedAt() != null) {
                logger.warn("삭제된 계약서에 대한 파일 접근 시도 - contractId: {}", contract.getId());
                throw new CustomException(CustomExceptionEnum.CONTRACT_NOT_FOUND);
            }

            // 권한 검사
            boolean isCreator = contract.getCreatedBy().getUuid().equals(userUuid);
            boolean isParticipant = contractPartyRepository.findByContractAndParty(contract, user).isPresent();

            if (!isCreator && !isParticipant) {
                logger.warn("파일 다운로드 권한 없음 - contractId: {}, userUuid: {}", contract.getId(), userUuid);
                throw new CustomException(CustomExceptionEnum.UNAUTHORIZED);
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
                headers.setContentType(MediaType.APPLICATION_PDF);
                headers.setContentLength(fileBytes.length);
                headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline");
                headers.set(HttpHeaders.CACHE_CONTROL, "private, max-age=3600");
                headers.set(HttpHeaders.ETAG, "\"" + version.getFileHash() + "\"");

                logger.info("파일 다운로드 성공 - filePath: {}, fileSize: {} bytes", filePath, fileBytes.length);
                
                return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);

            } catch (NoSuchKeyException e) {
                logger.error("S3에서 파일을 찾을 수 없음 - filePath: {}", filePath);
                throw new CustomException(CustomExceptionEnum.CONTRACT_NOT_FOUND);
            } catch (SdkException e) {
                logger.error("S3 파일 다운로드 중 SDK 오류 - filePath: {}, error: {}", filePath, e.getMessage());
                throw new RuntimeException("파일 다운로드 중 오류가 발생했습니다: " + e.getMessage(), e);
            }

        } catch (CustomException e) {
            logger.error("파일 다운로드 권한 오류 - filePath: {}, error: {}", filePath, e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("파일 다운로드 중 오류 - filePath: {}, error: {}", filePath, e.getMessage(), e);
            throw new RuntimeException("파일 다운로드 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
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