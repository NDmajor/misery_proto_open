package com.contract.backend.common.config;

import com.contract.backend.common.util.jwt.JwtAuthenticationFilter;
import com.contract.backend.common.util.jwt.JwtTokenProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtTokenProvider jwtTokenProvider) throws Exception {
        http
            .cors()
            .and()
            .csrf().disable()
            .authorizeHttpRequests()
            .requestMatchers("/auth/**").permitAll()
            .requestMatchers("/api/users/search").authenticated()
            
            // 새로운 파일 접근 엔드포인트들
            .requestMatchers("/api/contracts/*/preview").authenticated()         // 미리보기
            .requestMatchers("/api/contracts/*/download").authenticated()        // 다운로드
            .requestMatchers("/api/contracts/*/versions/*/preview").authenticated()  // 버전별 미리보기
            .requestMatchers("/api/contracts/*/versions/*/download").authenticated() // 버전별 다운로드
            
            // 기존 엔드포인트들
            .requestMatchers("/api/contracts/files/**").authenticated()     // 기존 파일 접근 (deprecated)
            .requestMatchers("/api/contracts/**").authenticated()           // 모든 계약서 API
            .anyRequest().authenticated()
            .and()
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider),
                    UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
    
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("https://localhost:5173")); // React 개발 서버
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type","X-XSRF-TOKEN","Authorization"));
        configuration.setAllowCredentials(true);
        
        // PDF 관련 헤더들 노출 허용
        configuration.setExposedHeaders(List.of(
            "Content-Disposition", 
            "Content-Type",
            "Content-Length",
            "Cache-Control",
            "ETag"
        ));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}