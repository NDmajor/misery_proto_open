package com.contract.backend.controller;


import com.contract.backend.common.Entity.UserEntity;
import com.contract.backend.service.AuthService;
import com.contract.backend.service.ContractSignatureService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/contracts")
public class ContractSignatureController {

    private final ContractSignatureService contractSignatureService;
    private final AuthService authService;

    public ContractSignatureController(
            ContractSignatureService contractSignatureService,
            AuthService authService
    ) {
        this.contractSignatureService = contractSignatureService;
        this.authService = authService;
    }

    @PostMapping("/{versionId}/sign")
    public ResponseEntity<?> signContract(
            @PathVariable Long versionId,
            @AuthenticationPrincipal String uuid
    ) {
        try {
            UserEntity user = authService.findByUuid(uuid);
            contractSignatureService.signContract(versionId, user);
            return ResponseEntity.ok("서명이 완료되었습니다.");
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body("이미 서명하셨습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("서명할 수 없습니다: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("서명 중 오류 발생: " + e.getMessage());
        }
    }
}
