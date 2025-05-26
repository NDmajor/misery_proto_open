package com.contract.backend.controller;

import com.contract.backend.common.Entity.ContractEntity;
import com.contract.backend.common.Entity.ContractPartyEntity; 
import com.contract.backend.common.Entity.ContractVersionEntity;
import com.contract.backend.common.Entity.UserEntity;
import com.contract.backend.common.dto.ContractUploadRequestDTO;
import com.contract.backend.common.repository.ContractPartyRepository; 
import com.contract.backend.common.response.ApiResponse;
import com.contract.backend.service.AuthService;
import com.contract.backend.service.B2StorageServiceImpl;
import com.contract.backend.service.ContractService;
import com.contract.backend.common.repository.ContractVersionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus; 
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException; 
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/contracts")
public class ContractController {

    private final ContractService contractService;
    private final AuthService authService;
    private final ContractVersionRepository contractVersionRepository;
    private final B2StorageServiceImpl b2StorageService;
    private final ContractPartyRepository contractPartyRepository;

    public ContractController(
            ContractService contractService,
            AuthService authService,
            ContractVersionRepository contractVersionRepository,
            B2StorageServiceImpl b2StorageService,
            ContractPartyRepository contractPartyRepository // 추가
    ) {
        this.contractService = contractService;
        this.authService = authService;
        this.contractVersionRepository = contractVersionRepository;
        this.b2StorageService = b2StorageService;
        this.contractPartyRepository = contractPartyRepository; // 추가
    }

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<String>> uploadContract(
            @RequestPart("data") ContractUploadRequestDTO request,
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal String uuid
    ) {
        log.info("[ContractController] Upload contract request received for user UUID: {}", uuid);
        try {
            UserEntity user = authService.findByUuid(uuid);
            log.debug("[ContractController] User found for UUID {}: {}", uuid, user.getUserName());
            ContractEntity contract = contractService.uploadContract(request, user, file);
            log.info("[ContractController] Contract uploaded successfully for user {}. Contract ID: {}", user.getUserName(), contract.getId());
            return ResponseEntity.ok(ApiResponse.success("Contract uploaded successfully. ID: " + contract.getId()));
        } catch (Exception e) {
            log.error("[ContractController] Error uploading contract for user UUID {}: {}", uuid, e.getMessage(), e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Upload failed: " + e.getMessage()));
        }
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<ContractResponseDTO>>> getMyContracts(
            @AuthenticationPrincipal String uuid,
            @RequestParam(required = false) String search
    ) {
        log.info("[ContractController] Get my contracts request received for user UUID: {}, Search term: {}", uuid, search);
        try {
            UserEntity currentUser = authService.findByUuid(uuid);
            log.debug("[ContractController] Current user for fetching contracts: {}", currentUser.getUserName());

            List<ContractEntity> contracts = contractService.getMyContracts(currentUser, search);
            log.info("[ContractController] Found {} contracts for user {}", contracts.size(), currentUser.getUserName());

            List<ContractResponseDTO> contractResponseDTOS = contracts.stream()
                    .map(ContractResponseDTO::new)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(ApiResponse.success(contractResponseDTOS));
        } catch (Exception e) {
            log.error("[ContractController] Error fetching contracts for user UUID {}: {}", uuid, e.getMessage(), e);
            // 클라이언트에게는 상세 오류 메시지 대신 일반적인 메시지를 전달할 수 있습니다.
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to fetch contracts."));
        }
    }

    @GetMapping("/versions/{versionId}/file-url")
    public ResponseEntity<ApiResponse<String>> getContractFilePresignedUrl(
            @PathVariable Long versionId,
            @AuthenticationPrincipal String userUuid
    ) {
        log.info("[ContractController] Request for presigned URL for version ID: {} by user UUID: {}", versionId, userUuid);
        try {
            UserEntity currentUser = authService.findByUuid(userUuid);
            ContractVersionEntity version = contractVersionRepository.findById(versionId)
                    .orElseThrow(() -> {
                        log.warn("[ContractController] ContractVersion not found for ID: {}", versionId);
                        return new RuntimeException("Contract version not found with ID: " + versionId);
                    });

            // 보안: 현재 사용자가 해당 계약의 참여자인지 확인
            ContractEntity contract = version.getContract();
            contractPartyRepository.findByContractAndParty(contract, currentUser)
                    .orElseThrow(() -> {
                        log.warn("[ContractController] User {} is not a party to contract ID: {}. Access denied to version ID: {}",
                                currentUser.getUserName(), contract.getId(), versionId);
                        return new AccessDeniedException("User does not have access to this contract version.");
                    });
            log.debug("[ContractController] User {} has access to contract version ID: {}", currentUser.getUserName(), versionId);


            String fileKey = version.getFilePath();
            if (fileKey == null || fileKey.trim().isEmpty()) {
                log.warn("[ContractController] File path is missing for version ID: {}", versionId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.fail("File path not found for this contract version."));
            }

            // Presigned URL 생성 (예: 10분 유효)
            String presignedUrl = b2StorageService.generatePresignedGetUrl(fileKey, 10);

            if (presignedUrl == null) {
                log.error("[ContractController] Failed to generate presigned URL for file key: {}", fileKey);
                return ResponseEntity.internalServerError().body(ApiResponse.fail("Could not generate file URL. Please try again later."));
            }
            log.info("[ContractController] Generated presigned URL for version {}: {}", versionId, presignedUrl);
            return ResponseEntity.ok(ApiResponse.success(presignedUrl));

        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.fail(e.getMessage()));
        } catch (RuntimeException e) {
             log.error("[ContractController] Error getting presigned URL for versionId {}: {}", versionId, e.getMessage(), e);
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.fail(e.getMessage()));
            }
            return ResponseEntity.internalServerError().body(ApiResponse.fail("An error occurred while processing your request."));
        }
    }
}


class ContractResponseDTO {
    private Long id;
    private String title;
    private String description;
    private String createdByUserName;
    private String status;
    private String createdAt;
    private Integer currentVersionNumber;
    private Long currentVersionId; // 이 필드가 중요합니다!

    public ContractResponseDTO(ContractEntity contract) {
        this.id = contract.getId();
        this.title = contract.getTitle();
        this.description = contract.getDescription();
        this.createdByUserName = contract.getCreatedBy().getUserName();
        this.status = contract.getStatus().name();
        this.createdAt = contract.getCreatedAt().toString(); // ISO 8601 형식 권장

        if (contract.getCurrentVersion() != null) {
            this.currentVersionNumber = contract.getCurrentVersion().getVersionNumber();
            this.currentVersionId = contract.getCurrentVersion().getId(); // <<-- 이 부분 확인!!
            // ContractVersionEntity에 getId() 메소드가 Long 타입을 반환해야 합니다.
        } else {
            this.currentVersionNumber = null;
            this.currentVersionId = null; // currentVersion이 없으면 null로 설정
        }
    }

    // Getters
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getCreatedByUserName() { return createdByUserName; }
    public String getStatus() { return status; }
    public String getCreatedAt() { return createdAt; }
    public Integer getCurrentVersionNumber() { return currentVersionNumber; }
    public Long getCurrentVersionId() { return currentVersionId; } 
}

