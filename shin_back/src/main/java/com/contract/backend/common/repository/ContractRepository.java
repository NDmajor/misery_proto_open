package com.contract.backend.common.repository;

import com.contract.backend.common.Entity.ContractEntity;
import com.contract.backend.common.Entity.UserEntity;
import com.contract.backend.common.Entity.enumm.ContractStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor; 
import org.springframework.stereotype.Repository; 

import java.util.List;

@Repository 
public interface ContractRepository extends JpaRepository<ContractEntity, Long>, JpaSpecificationExecutor<ContractEntity> { // <<< JpaSpecificationExecutor 상속 추가
    List<ContractEntity> findByCreatedBy(UserEntity user);
    List<ContractEntity> findByStatus(ContractStatus status);
}