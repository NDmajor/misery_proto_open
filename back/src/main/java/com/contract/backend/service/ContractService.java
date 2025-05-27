package com.contract.backend.service;

import com.contract.backend.common.Entity.*;
import com.contract.backend.common.Entity.enumm.ContractStatus;
import com.contract.backend.common.Entity.enumm.PartyRole;
import com.contract.backend.common.Entity.enumm.VersionStatus;
import com.contract.backend.common.repository.*;
import com.contract.backend.common.dto.ContractUploadRequestDTO;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import lombok.extern.slf4j.Slf4j;

import java.security.MessageDigest;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ContractService {

    private final ContractRepository contractRepository;
    private final ContractVersionRepository contractVersionRepository;
    private final ContractPartyRepository contractPartyRepository;
    private final S3StorageService s3StorageService;
    private final UserRepository userRepository;

    public ContractService(
            ContractRepository contractRepository,
            ContractVersionRepository contractVersionRepository,
            ContractPartyRepository contractPartyRepository,
            S3StorageService s3StorageService,
            UserRepository userRepository) {
        this.contractRepository = contractRepository;
        this.contractVersionRepository = contractVersionRepository;
        this.contractPartyRepository = contractPartyRepository;
        this.s3StorageService = s3StorageService;
        this.userRepository = userRepository;
    }

    @Transactional
    public ContractEntity uploadContract(
            ContractUploadRequestDTO request,
            UserEntity uploader,
            MultipartFile file
    ) throws Exception {

        log.info("[ContractService] Uploading contract titled '{}' by user {}", request.getTitle(), uploader.getUserName());
        // 1. Contract 생성
        ContractEntity contract = new ContractEntity(
                request.getTitle(),
                request.getDescription(),
                uploader,
                ContractStatus.OPEN
        );
        contract = contractRepository.save(contract);
        log.debug("[ContractService] Contract entity saved with ID: {}", contract.getId());

        // 2. 파일 해시 생성
        String fileHash = generateSHA256(file.getBytes());

        // 3. 파일 업로드
        String filePath = s3StorageService.upload(file);
        String bucket = s3StorageService.getBucketName();

        // 4. ContractVersion 생성
        ContractVersionEntity version = new ContractVersionEntity(
                contract,
                1,
                filePath,
                fileHash,
                VersionStatus.PENDING_SIGNATURE
        );
        version.setBucketName(bucket);
        version.setStorageProvider("B2");
        contractVersionRepository.save(version);

        // 5. Contract 업데이트
        contract.setCurrentVersion(version);
        contractRepository.save(contract);

        log.debug("[ContractService] Mapping participants for contract ID: {}. Uploader (INITIATOR): {}", contract.getId(), uploader.getUserName());

        // 6. 참여자 매핑
        contractPartyRepository.save(new ContractPartyEntity(contract, uploader, PartyRole.INITIATOR));

        for (UUID uuid : request.getParticipantIds()) {
           UserEntity participant = userRepository.findByUuid(uuid.toString()) //
                            .orElseThrow(() -> new RuntimeException("해당 UUID를 가진 참여자(사용자)를 찾을 수 없습니다: " + uuid));
            contractPartyRepository.save(new ContractPartyEntity(contract, participant, PartyRole.COUNTERPARTY));
            log.debug("[ContractService] Added participant {} as COUNTERPARTY to contract ID: {}", participant.getUserName(), contract.getId());
        }
        log.info("[ContractService] Contract upload process completed for contract ID: {}", contract.getId());
        return contract;
    }

    private String generateSHA256(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(data);
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public List<ContractEntity> getMyContracts(UserEntity currentUser, String searchTerm) {
        log.info("[ContractService] Getting contracts for user: {}, searchTerm: '{}'", currentUser.getUserName(), searchTerm);

        List<ContractPartyEntity> parties = contractPartyRepository.findAllByParty(currentUser);
        log.debug("[ContractService] Found {} contract party entries for user {}", parties.size(), currentUser.getUserName());

        List<Long> contractIdsInvolved = parties
                .stream()
                .map(cp -> cp.getContract().getId())
                .distinct()
                .collect(Collectors.toList());

        log.debug("[ContractService] User {} is involved in contract IDs: {}", currentUser.getUserName(), contractIdsInvolved);

        if (contractIdsInvolved.isEmpty()) {
            log.info("[ContractService] User {} is not involved in any contracts. Returning empty list.", currentUser.getUserName());
            return List.of();
        }

        Specification<ContractEntity> spec = Specification.where(ContractSpecifications.idIn(contractIdsInvolved));
        log.debug("[ContractService] Initial specification: idIn={}", contractIdsInvolved);

        if (StringUtils.hasText(searchTerm)) {
            spec = spec.and(ContractSpecifications.titleContains(searchTerm));
            log.debug("[ContractService] Added titleContains specification for searchTerm: '{}'", searchTerm);
        }
        spec = spec.and(ContractSpecifications.notDeleted());
        log.debug("[ContractService] Added notDeleted specification.");

        List<ContractEntity> foundContracts = contractRepository.findAll(spec);
        log.info("[ContractService] Found {} contracts matching criteria for user {}", foundContracts.size(), currentUser.getUserName());
        return foundContracts;
    }
}

class ContractSpecifications {
    public static Specification<ContractEntity> titleContains(String searchTerm) {
        return (root, query, criteriaBuilder) ->
                criteriaBuilder.like(criteriaBuilder.lower(root.get("title")), "%" + searchTerm.toLowerCase() + "%");
    }

    public static Specification<ContractEntity> idIn(List<Long> ids) {
        return (root, query, criteriaBuilder) ->
                root.get("id").in(ids);
    }

    public static Specification<ContractEntity> notDeleted() {
        return (root, query, criteriaBuilder) ->
                criteriaBuilder.isNull(root.get("deletedAt"));
    }

    // 필요시 추가 검색 조건 (예: 설명 검색)
    // public static Specification<ContractEntity> descriptionContains(String searchTerm) {
    //     return (root, query, criteriaBuilder) ->
    //             criteriaBuilder.like(criteriaBuilder.lower(root.get("description")), "%" + searchTerm.toLowerCase() + "%");
    // }
}

