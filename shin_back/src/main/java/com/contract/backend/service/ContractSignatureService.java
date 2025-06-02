package com.contract.backend.service;

import com.contract.backend.common.Entity.*;
import com.contract.backend.common.Entity.enumm.VersionStatus;
import com.contract.backend.common.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ContractSignatureService {

    private final ContractVersionRepository contractVersionRepository;
    private final SignatureRepository signatureRepository;
    private final ContractPartyRepository contractPartyRepository;

    public ContractSignatureService(
            ContractVersionRepository contractVersionRepository,
            SignatureRepository signatureRepository,
            ContractPartyRepository contractPartyRepository
    ) {
        this.contractVersionRepository = contractVersionRepository;
        this.signatureRepository = signatureRepository;
        this.contractPartyRepository = contractPartyRepository;
    }

    @Transactional
    public void signContract(Long versionId, UserEntity signer) throws Exception {
        ContractVersionEntity version = contractVersionRepository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("계약 버전을 찾을 수 없습니다."));

        ContractEntity contract = version.getContract();

        // 1. 참여자인지 검증
        ContractPartyEntity party = contractPartyRepository.findByContractAndParty(contract, signer)
                .orElseThrow(() -> new IllegalArgumentException("해당 계약의 참여자가 아닙니다."));

        // 2. 이미 서명했는지 확인
        if (signatureRepository.existsByContractVersionAndSigner(version, signer)) {
            throw new IllegalStateException("이미 서명한 계약입니다.");
        }

        // 3. 서명 해시 생성
        String signatureHash = generateSignatureHash(signer.getUuid(), version.getFileHash(), LocalDateTime.now());

        // 4. 서명 저장
        SignatureEntity signature = new SignatureEntity(version, signer, signatureHash);
        signatureRepository.save(signature);

        // 5. 모든 참여자 서명 완료 여부 확인
        long totalParticipants = contractPartyRepository.findByContract(contract).size();
        long signedCount = signatureRepository.countByContractVersion(version);

        if (totalParticipants == signedCount) {
            version.setStatus(VersionStatus.SIGNED);
            contractVersionRepository.save(version);
        }
    }

    private String generateSignatureHash(String userUuid, String fileHash, LocalDateTime now) throws Exception {
        String input = userUuid + fileHash + now.toString();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes());
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
