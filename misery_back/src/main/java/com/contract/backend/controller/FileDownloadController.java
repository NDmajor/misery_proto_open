// package com.contract.backend.controller;

// import com.contract.backend.common.Entity.ContractEntity;
// import com.contract.backend.common.Entity.ContractPartyEntity;
// import com.contract.backend.common.Entity.ContractVersionEntity;
// import com.contract.backend.common.Entity.UserEntity;
// import com.contract.backend.common.exception.CustomException;
// import com.contract.backend.common.exception.CustomExceptionEnum;
// import com.contract.backend.common.repository.ContractPartyRepository;
// import com.contract.backend.common.repository.ContractRepository;
// import com.contract.backend.common.repository.ContractVersionRepository;
// import com.contract.backend.service.AuthService;
// import com.contract.backend.service.S3StorageService;
// import org.slf4j.Logger;
// import org.slf4j.LoggerFactory;
// import org.springframework.core.io.Resource;
// import org.springframework.http.HttpHeaders;
// import org.springframework.http.HttpStatus;
// import org.springframework.http.MediaType;
// import org.springframework.http.ResponseEntity;
// import org.springframework.security.core.annotation.AuthenticationPrincipal;
// import org.springframework.web.bind.annotation.*;
// import software.amazon.awssdk.core.ResponseInputStream;
// import software.amazon.awssdk.core.exception.SdkException;
// import software.amazon.awssdk.services.s3.S3Client;
// import software.amazon.awssdk.services.s3.model.GetObjectRequest;
// import software.amazon.awssdk.services.s3.model.GetObjectResponse;
// import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

// import java.io.ByteArrayOutputStream;
// import java.io.IOException;
// import java.io.InputStream;
// import java.net.URLEncoder;
// import java.nio.charset.StandardCharsets;
// import java.util.Optional;

// @RestController
// @RequestMapping("/api/contracts")
// public class FileDownloadController {

//     private static final Logger logger = LoggerFactory.getLogger(FileDownloadController.class);

//     private final S3Client s3Client;
//     private final S3StorageService s3StorageService;
//     private final ContractRepository contractRepository;
//     private final ContractVersionRepository contractVersionRepository;
//     private final ContractPartyRepository contractPartyRepository;
//     private final AuthService authService;

//     public FileDownloadController(
//             S3Client s3Client,
//             S3StorageService s3StorageService,
//             ContractRepository contractRepository,
//             ContractVersionRepository contractVersionRepository,
//             ContractPartyRepository contractPartyRepository,
//             AuthService authService
//     ) {
//         this.s3Client = s3Client;
//         this.s3StorageService = s3StorageService;
//         this.contractRepository = contractRepository;
//         this.contractVersionRepository = contractVersionRepository;
//         this.contractPartyRepository = contractPartyRepository;
//         this.authService = authService;
//     }

//     @GetMapping("/files/{filePath:.+}")
//     public ResponseEntity<byte[]> downloadFile(
//             @PathVariable String filePath,
//             @AuthenticationPrincipal String userUuid
//     ) {
//         try {
//             logger.info("파일 다운로드 요청 - filePath: {}, userUuid: {}", filePath, userUuid);

//             // 사용자 인증
//             UserEntity user = authService.findByUuid(userUuid);

//             // 파일 경로로 해당 계약 버전 찾기
//             Optional<ContractVersionEntity> versionOpt = contractVersionRepository
//                     .findAll()
//                     .stream()
//                     .filter(v -> v.getFilePath().equals(filePath))
//                     .findFirst();

//             if (versionOpt.isEmpty()) {
//                 logger.warn("파일 경로에 해당하는 계약 버전을 찾을 수 없음: {}", filePath);
//                 throw new CustomException(CustomExceptionEnum.CONTRACT_NOT_FOUND);
//             }

//             ContractVersionEntity version = versionOpt.get();
//             ContractEntity contract = version.getContract();

//             // 권한 검사: 생성자이거나 참여자여야 함
//             boolean isCreator = contract.getCreatedBy().getUuid().equals(userUuid);
//             boolean isParticipant = contractPartyRepository.findByContractAndParty(contract, user).isPresent();

//             if (!isCreator && !isParticipant) {
//                 logger.warn("파일 다운로드 권한 없음 - contractId: {}, userUuid: {}", contract.getId(), userUuid);
//                 throw new CustomException(CustomExceptionEnum.UNAUTHORIZED);
//             }

//             logger.info("파일 다운로드 권한 확인 완료 - contractId: {}, userUuid: {}", contract.getId(), userUuid);

//             // S3에서 파일 다운로드
//             String bucketName = s3StorageService.getBucketName();
            
//             GetObjectRequest getObjectRequest = GetObjectRequest.builder()
//                     .bucket(bucketName)
//                     .key(filePath)
//                     .build();

//             try (ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getObjectRequest)) {
//                 byte[] fileBytes = readAllBytes(s3Object);
                
//                 // 파일명 생성 (계약서 제목 + 버전)
//                 String fileName = String.format("%s_v%d.pdf", 
//                     contract.getTitle().replaceAll("[^a-zA-Z0-9가-힣\\s]", ""), 
//                     version.getVersionNumber());
                
//                 // URL 인코딩
//                 String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8.toString())
//                         .replaceAll("\\+", "%20");

//                 HttpHeaders headers = new HttpHeaders();
//                 headers.setContentType(MediaType.APPLICATION_PDF);
//                 headers.setContentLength(fileBytes.length);
//                 headers.set(HttpHeaders.CONTENT_DISPOSITION, 
//                     "inline; filename*=UTF-8''" + encodedFileName);
//                 headers.set(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
//                 headers.set(HttpHeaders.PRAGMA, "no-cache");
//                 headers.set(HttpHeaders.EXPIRES, "0");

//                 logger.info("파일 다운로드 성공 - filePath: {}, fileSize: {} bytes", filePath, fileBytes.length);
                
//                 return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);

//             } catch (NoSuchKeyException e) {
//                 logger.error("S3에서 파일을 찾을 수 없음 - filePath: {}", filePath);
//                 return ResponseEntity.notFound().build();
//             } catch (SdkException e) {
//                 logger.error("S3 파일 다운로드 중 SDK 오류 - filePath: {}, error: {}", filePath, e.getMessage());
//                 throw new RuntimeException("파일 다운로드 중 오류가 발생했습니다: " + e.getMessage(), e);
//             }

//         } catch (CustomException e) {
//             logger.error("CustomException 발생 - filePath: {}, error: {}", filePath, e.getMessage());
//             throw e;
//         } catch (Exception e) {
//             logger.error("파일 다운로드 중 예상치 못한 오류 - filePath: {}, error: {}", filePath, e.getMessage(), e);
//             throw new RuntimeException("파일 다운로드 중 오류가 발생했습니다: " + e.getMessage(), e);
//         }
//     }

//     // InputStream을 byte[]로 읽는 헬퍼 메소드
//     private byte[] readAllBytes(InputStream inputStream) throws IOException {
//         ByteArrayOutputStream buffer = new ByteArrayOutputStream();
//         byte[] data = new byte[8192];
//         int bytesRead;
        
//         while ((bytesRead = inputStream.read(data, 0, data.length)) != -1) {
//             buffer.write(data, 0, bytesRead);
//         }
        
//         return buffer.toByteArray();
//     }
// }