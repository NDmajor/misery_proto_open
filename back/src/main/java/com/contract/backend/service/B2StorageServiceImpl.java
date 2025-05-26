package com.contract.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class B2StorageServiceImpl implements S3StorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${b2.bucket-name}")
    private String bucketName;

    public B2StorageServiceImpl(
            @Value("${b2.endpoint}") String endpoint,
            @Value("${b2.access-key}") String accessKey,
            @Value("${b2.secret-key}") String secretKey
            // S3Presigner는 별도의 Bean으로 생성하거나 여기서 직접 생성할 수 있습니다.
            // 여기서는 생성자에서 직접 생성하는 것으로 가정합니다.
    ) {
        StaticCredentialsProvider credentialsProvider = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKey, secretKey)
        );

        this.s3Client = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(credentialsProvider)
                .region(Region.of("us-east-005")) // B2 endpoint에 맞는 리전 명시 (예시)
                .build();

        this.s3Presigner = S3Presigner.builder()
                .region(Region.of("us-east-005")) // s3Client와 동일 리전
                .endpointOverride(URI.create(endpoint)) // s3Client와 동일 엔드포인트
                .credentialsProvider(credentialsProvider) // 동일한 자격 증명 사용
                .build();
        log.info("B2StorageService initialized with endpoint: {}, bucket: {}", endpoint, bucketName);
    }

    @Override
    public String upload(MultipartFile file) throws IOException {
        String key = generateFileKey(file.getOriginalFilename());
        log.info("Uploading file with key: {} to bucket: {}", key, bucketName);

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(putRequest, RequestBody.fromBytes(file.getBytes()));
        log.info("File uploaded successfully: {}", key);
        return key;
    }

    @Override
    public String getBucketName() {
        return bucketName;
    }

    private String generateFileKey(String originalFileName) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return "contracts/" + timestamp + "_" + UUID.randomUUID().toString().substring(0, 8) + "_" + originalFileName;
    }

    // 파일 스트리밍 (필요시 사용)
    public ResponseInputStream<GetObjectResponse> downloadFile(String fileKey) throws Exception {
        log.debug("Downloading file with key: {} from bucket: {}", fileKey, bucketName);
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(fileKey)
                .build();
        return s3Client.getObject(getObjectRequest);
    }

    // Presigned URL 생성 메소드
    public String generatePresignedGetUrl(String fileKey, long durationMinutes) {
        if (fileKey == null) {
            log.warn("Cannot generate presigned URL for null fileKey");
            return null;
        }
        log.debug("Generating presigned URL for fileKey: {}, duration: {} minutes", fileKey, durationMinutes);
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(this.bucketName)
                    .key(fileKey)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(durationMinutes))
                    .getObjectRequest(getObjectRequest)
                    .build();

            PresignedGetObjectRequest presignedGetObjectRequest = this.s3Presigner.presignGetObject(presignRequest);
            String url = presignedGetObjectRequest.url().toString();
            log.info("Successfully generated presigned URL for {}: {}", fileKey, url);
            return url;
        } catch (Exception e) {
            log.error("Error generating presigned URL for key {}: {}", fileKey, e.getMessage(), e);
            return null;
        }
    }
}
