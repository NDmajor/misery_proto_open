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

@RestController
@RequestMapping("/api/contracts")
public class ContractFileController {

    private static final Logger logger = LoggerFactory.getLogger(ContractFileController.class);

    private final S3Client s3Client;
    private final S3StorageService s3StorageService;
    private final ContractRepository contractRepository;
    private final ContractVersionRepository contractVersionRepository;
    private final ContractPartyRepository contractPartyRepository;
    private final AuthService authService;

    public ContractFileController(
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

    /**
     * PDF 미리보기 - 브라우저에서 바로 표시용
     * Content-Disposition: inline 설정
     */
    @GetMapping("/{contractId}/preview")
    public ResponseEntity<byte[]> previewContract(
            @PathVariable Long contractId,
            @AuthenticationPrincipal String userUuid
    ) {
        try {
            logger.info("계약서 미리보기 요청 - contractId: {}, userUuid: {}", contractId, userUuid);
            
            // 권한 검증 및 파일 데이터 가져오기
            FileAccessResult fileResult = getFileWithPermissionCheck(contractId, null, userUuid);
            
            // 미리보기용 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentLength(fileResult.fileBytes.length);
            
            // 브라우저에서 바로 표시되도록 inline 설정
            headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline");
            
            // 캐싱 설정 (미리보기는 캐시 허용)
            headers.set(HttpHeaders.CACHE_CONTROL, "private, max-age=3600");
            headers.set(HttpHeaders.ETAG, "\"" + fileResult.version.getFileHash() + "\"");
            
            logger.info("계약서 미리보기 성공 - contractId: {}, fileSize: {} bytes", 
                contractId, fileResult.fileBytes.length);
            
            return new ResponseEntity<>(fileResult.fileBytes, headers, HttpStatus.OK);
            
        } catch (CustomException e) {
            logger.error("계약서 미리보기 권한 오류 - contractId: {}, error: {}", contractId, e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("계약서 미리보기 중 오류 - contractId: {}, error: {}", contractId, e.getMessage(), e);
            throw new RuntimeException("계약서 미리보기 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    /**
     * 특정 버전 PDF 미리보기
     */
    @GetMapping("/{contractId}/versions/{versionNumber}/preview")
    public ResponseEntity<byte[]> previewContractVersion(
            @PathVariable Long contractId,
            @PathVariable Integer versionNumber,
            @AuthenticationPrincipal String userUuid
    ) {
        try {
            logger.info("계약서 버전 미리보기 요청 - contractId: {}, version: {}, userUuid: {}", 
                contractId, versionNumber, userUuid);
            
            // 권한 검증 및 파일 데이터 가져오기
            FileAccessResult fileResult = getFileWithPermissionCheck(contractId, versionNumber, userUuid);
            
            // 미리보기용 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentLength(fileResult.fileBytes.length);
            headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline");
            headers.set(HttpHeaders.CACHE_CONTROL, "private, max-age=3600");
            headers.set(HttpHeaders.ETAG, "\"" + fileResult.version.getFileHash() + "\"");
            
            logger.info("계약서 버전 미리보기 성공 - contractId: {}, version: {}, fileSize: {} bytes", 
                contractId, versionNumber, fileResult.fileBytes.length);
            
            return new ResponseEntity<>(fileResult.fileBytes, headers, HttpStatus.OK);
            
        } catch (CustomException e) {
            logger.error("계약서 버전 미리보기 권한 오류 - contractId: {}, version: {}, error: {}", 
                contractId, versionNumber, e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("계약서 버전 미리보기 중 오류 - contractId: {}, version: {}, error: {}", 
                contractId, versionNumber, e.getMessage(), e);
            throw new RuntimeException("계약서 버전 미리보기 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    /**
     * PDF 다운로드 - 파일 저장용
     * Content-Disposition: attachment 설정
     */
    @GetMapping("/{contractId}/download")
    public ResponseEntity<byte[]> downloadContract(
            @PathVariable Long contractId,
            @AuthenticationPrincipal String userUuid
    ) {
        try {
            logger.info("계약서 다운로드 요청 - contractId: {}, userUuid: {}", contractId, userUuid);
            
            // 권한 검증 및 파일 데이터 가져오기
            FileAccessResult fileResult = getFileWithPermissionCheck(contractId, null, userUuid);
            
            // 다운로드용 파일명 생성
            String fileName = generateFileName(fileResult.contract, fileResult.version);
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8.toString())
                    .replaceAll("\\+", "%20");
            
            // 다운로드용 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentLength(fileResult.fileBytes.length);
            
            // 파일 다운로드되도록 attachment 설정
            headers.set(HttpHeaders.CONTENT_DISPOSITION, 
                "attachment; filename*=UTF-8''" + encodedFileName);
            
            // 다운로드는 캐시 방지
            headers.set(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
            headers.set(HttpHeaders.PRAGMA, "no-cache");
            headers.set(HttpHeaders.EXPIRES, "0");
            
            logger.info("계약서 다운로드 성공 - contractId: {}, fileName: {}, fileSize: {} bytes", 
                contractId, fileName, fileResult.fileBytes.length);
            
            return new ResponseEntity<>(fileResult.fileBytes, headers, HttpStatus.OK);
            
        } catch (CustomException e) {
            logger.error("계약서 다운로드 권한 오류 - contractId: {}, error: {}", contractId, e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("계약서 다운로드 중 오류 - contractId: {}, error: {}", contractId, e.getMessage(), e);
            throw new RuntimeException("계약서 다운로드 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    /**
     * 특정 버전 PDF 다운로드
     */
    @GetMapping("/{contractId}/versions/{versionNumber}/download")
    public ResponseEntity<byte[]> downloadContractVersion(
            @PathVariable Long contractId,
            @PathVariable Integer versionNumber,
            @AuthenticationPrincipal String userUuid
    ) {
        try {
            logger.info("계약서 버전 다운로드 요청 - contractId: {}, version: {}, userUuid: {}", 
                contractId, versionNumber, userUuid);
            
            // 권한 검증 및 파일 데이터 가져오기
            FileAccessResult fileResult = getFileWithPermissionCheck(contractId, versionNumber, userUuid);
            
            // 다운로드용 파일명 생성
            String fileName = generateFileName(fileResult.contract, fileResult.version);
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8.toString())
                    .replaceAll("\\+", "%20");
            
            // 다운로드용 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentLength(fileResult.fileBytes.length);
            headers.set(HttpHeaders.CONTENT_DISPOSITION, 
                "attachment; filename*=UTF-8''" + encodedFileName);
            headers.set(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
            headers.set(HttpHeaders.PRAGMA, "no-cache");
            headers.set(HttpHeaders.EXPIRES, "0");
            
            logger.info("계약서 버전 다운로드 성공 - contractId: {}, version: {}, fileName: {}, fileSize: {} bytes", 
                contractId, versionNumber, fileName, fileResult.fileBytes.length);
            
            return new ResponseEntity<>(fileResult.fileBytes, headers, HttpStatus.OK);
            
        } catch (CustomException e) {
            logger.error("계약서 버전 다운로드 권한 오류 - contractId: {}, version: {}, error: {}", 
                contractId, versionNumber, e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("계약서 버전 다운로드 중 오류 - contractId: {}, version: {}, error: {}", 
                contractId, versionNumber, e.getMessage(), e);
            throw new RuntimeException("계약서 버전 다운로드 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    /**
     * 권한 검증 및 파일 데이터 조회 공통 메서드
     */
    private FileAccessResult getFileWithPermissionCheck(Long contractId, Integer versionNumber, String userUuid) {
        // 사용자 인증
        UserEntity user = authService.findByUuid(userUuid);

        // 계약서 조회 (삭제되지 않은 것만)
        ContractEntity contract = contractRepository.findByIdAndNotDeleted(contractId)
                .orElseThrow(() -> new CustomException(CustomExceptionEnum.CONTRACT_NOT_FOUND));

        // 버전 조회
        ContractVersionEntity version;
        if (versionNumber != null) {
            // 특정 버전 조회
            version = contractVersionRepository.findByContractAndVersionNumber(contract, versionNumber)
                    .orElseThrow(() -> new CustomException(CustomExceptionEnum.VERSION_NOT_FOUND));
        } else {
            // 현재 버전 조회
            version = contract.getCurrentVersion();
            if (version == null) {
                throw new CustomException(CustomExceptionEnum.VERSION_NOT_FOUND);
            }
        }

        // 권한 검사: 생성자이거나 참여자여야 함
        boolean isCreator = contract.getCreatedBy().getUuid().equals(userUuid);
        boolean isParticipant = contractPartyRepository.findByContractAndParty(contract, user).isPresent();

        if (!isCreator && !isParticipant) {
            logger.warn("파일 접근 권한 없음 - contractId: {}, userUuid: {}", contractId, userUuid);
            throw new CustomException(CustomExceptionEnum.UNAUTHORIZED);
        }

        // S3에서 파일 다운로드
        try {
            String bucketName = s3StorageService.getBucketName();
            String filePath = version.getFilePath();
            
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filePath)
                    .build();

            try (ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getObjectRequest)) {
                byte[] fileBytes = readAllBytes(s3Object);
                return new FileAccessResult(contract, version, fileBytes);
            }

        } catch (NoSuchKeyException e) {
            logger.error("S3에서 파일을 찾을 수 없음 - contractId: {}, filePath: {}", 
                contractId, version.getFilePath());
            throw new CustomException(CustomExceptionEnum.CONTRACT_NOT_FOUND);
        } catch (SdkException e) {
            logger.error("S3 파일 다운로드 중 SDK 오류 - contractId: {}, error: {}", contractId, e.getMessage());
            throw new RuntimeException("파일 다운로드 중 오류가 발생했습니다: " + e.getMessage(), e);
        } catch (IOException e) {
            logger.error("파일 읽기 중 오류 - contractId: {}, error: {}", contractId, e.getMessage());
            throw new RuntimeException("파일 읽기 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    /**
     * 다운로드용 파일명 생성
     */
    private String generateFileName(ContractEntity contract, ContractVersionEntity version) {
        // 특수문자 제거 및 공백을 언더스코어로 변경
        String cleanTitle = contract.getTitle()
                .replaceAll("[^a-zA-Z0-9가-힣\\s]", "")
                .replaceAll("\\s+", "_");
        
        return String.format("%s_v%d.pdf", cleanTitle, version.getVersionNumber());
    }

    /**
     * InputStream을 byte[]로 읽는 헬퍼 메서드
     */
    private byte[] readAllBytes(InputStream inputStream) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[8192];
        int bytesRead;
        
        while ((bytesRead = inputStream.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, bytesRead);
        }
        
        return buffer.toByteArray();
    }

    /**
     * 파일 접근 결과를 담는 내부 클래스
     */
    private static class FileAccessResult {
        final ContractEntity contract;
        final ContractVersionEntity version;
        final byte[] fileBytes;

        FileAccessResult(ContractEntity contract, ContractVersionEntity version, byte[] fileBytes) {
            this.contract = contract;
            this.version = version;
            this.fileBytes = fileBytes;
        }
    }
}