package com.contract.backend.common.repository;

import com.contract.backend.common.Entity.ContractVersionEntity;
import com.contract.backend.common.Entity.SignatureEntity;
import com.contract.backend.common.Entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SignatureRepository extends JpaRepository<SignatureEntity, Long> {
    // 특정 버전의 서명 전체 조회
    List<SignatureEntity> findByContractVersion(ContractVersionEntity contractVersion);

    // 특정 유저가 해당 계약 버전에 서명했는지 확인
    boolean existsByContractVersionAndSigner(ContractVersionEntity contractVersion, UserEntity signer);

    // 계약 버전에 대한 총 서명 수
    long countByContractVersion(ContractVersionEntity contractVersion);

    // 버전 + 서명자 기준 단일 조회 (예외 처리용)
    Optional<SignatureEntity> findByContractVersionAndSigner(ContractVersionEntity contractVersion, UserEntity signer);
}
