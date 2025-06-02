package com.contract.backend.controller;

import com.contract.backend.common.dto.UserSearchResponseDTO;
import com.contract.backend.common.response.ApiResponse; //
import com.contract.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "사용자 관리 (검색 등)")
public class UserController {

    private final UserService userService;

    @GetMapping("/search")
    @Operation(summary = "사용자 검색", description = "키워드를 사용하여 사용자 이름, 이메일, 식별자(UUID)를 검색합니다.")
    public ResponseEntity<ApiResponse<Page<UserSearchResponseDTO>>> searchUsers(
            @RequestParam String keyword,
            @PageableDefault(size = 10) Pageable pageable) {
        
        Page<UserSearchResponseDTO> users = userService.searchUsers(keyword, pageable);
        return ResponseEntity.ok(ApiResponse.success(users)); //
    }
}