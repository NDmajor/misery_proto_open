package com.contract.backend.common.dto;

import com.contract.backend.common.Entity.UserEntity; //
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UserSearchResponseDTO {
    private Long id;
    private String identifier; // 이 필드는 UserEntity의 UUID를 나타냅니다.
    private String name;       // 이 필드는 UserEntity의 사용자 이름을 나타냅니다.
    private String email;

    public UserSearchResponseDTO(UserEntity userEntity) { //
        this.id = userEntity.getId();
        this.identifier = userEntity.getUuid(); // userEntity.getIdentifier() 대신 userEntity.getUuid() 사용
        this.name = userEntity.getUserName(); // userEntity.getName() 대신 userEntity.getUserName() 사용
        this.email = userEntity.getEmail();
    }
}