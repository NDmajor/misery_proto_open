package com.contract.backend.common.repository;

import com.contract.backend.common.Entity.UserEntity; //
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, Long> { //
    Optional<UserEntity> findByEmail(String email); //

    Optional<UserEntity> findByUuid(String uuid); //

    boolean existsByEmail(String email);

    boolean existsByUuid(String uuid);


    // 사용자 검색을 위한 JPQL 쿼리 수정
    @Query("SELECT u FROM UserEntity u WHERE " + //
           "LOWER(u.userName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " + // u.name 대신 u.userName 사용
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(u.uuid) LIKE LOWER(CONCAT('%', :keyword, '%'))") // u.identifier 대신 u.uuid 사용
    Page<UserEntity> searchByKeyword(@Param("keyword") String keyword, Pageable pageable); //
}