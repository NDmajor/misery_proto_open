package com.contract.backend.common.util.jwt;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
public class JwtAuthenticationFilter extends GenericFilter {

    private final JwtTokenProvider jwtTokenProvider;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        String token = resolveToken(request);
        log.trace("[JwtAuthFilter] Resolved token: {}", token);

        if (token != null && jwtTokenProvider.validateToken(token)) {
            log.debug("[JwtAuthFilter] Token is valid.");
            String userUuid = jwtTokenProvider.getUserUuid(token);
            log.debug("[JwtAuthFilter] User UUID from token: {}", userUuid);

            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(userUuid, null, null);

                    SecurityContextHolder.getContext().setAuthentication(auth);
                    log.debug("[JwtAuthFilter] Authentication set in SecurityContext for user UUID: {}", userUuid);
                } else {
                    if (token == null) {
                        log.trace("[JwtAuthFilter] No JWT token found in request.");
                    } else {
                        log.warn("[JwtAuthFilter] Invalid JWT token: {}", token);
                    }
        }

        chain.doFilter(req, res);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        log.trace("[JwtAuthFilter] No 'Bearer ' token found in Authorization header.");
        return null;
    }
}