package com.contract.backend.service;

import com.contract.backend.common.Entity.UserEntity; //
import com.contract.backend.common.dto.UserSearchResponseDTO;
import com.contract.backend.common.repository.UserRepository; //
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository; //

    public Page<UserSearchResponseDTO> searchUsers(String keyword, Pageable pageable) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return Page.empty(pageable);
        }
        Page<UserEntity> userEntities = userRepository.searchByKeyword(keyword.trim(), pageable); //
        return userEntities.map(UserSearchResponseDTO::new);
    }
}