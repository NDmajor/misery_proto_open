import { bufferToBase64url } from "./webauthn";

// src/utils/api.ts
import Cookies from 'js-cookie';
export const BASE_URL = 'https://localhost:8443/auth';

function defaultHeaders() {
  const csrf = Cookies.get('XSRF-TOKEN');  // Spring이 발급한 CSRF 토큰 쿠키
  return {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {})
  };
}

export interface ContractUploadData {
  title: string;
  description?: string;
  participantIds: string[]; // UUID 문자열 배열
}

export const uploadContractApi = async (
  data: ContractUploadData,
  file: File
): Promise<any> => { // 실제 응답 타입에 맞게 수정 필요
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('인증 토큰이 없습니다.');
  }

  const formData = new FormData();

  // DTO를 JSON 문자열로 변환하여 'data' 파트에 추가
  formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  // 파일을 'file' 파트에 추가
  formData.append('file', file);

  const response = await fetch(`${BASE_URL.replace('/auth', '/api')}/contracts/upload`, { // BASE_URL 및 엔드포인트 확인
    method: 'POST',
    headers: {
      // 'Content-Type'은 FormData 사용 시 브라우저가 자동으로 설정하므로 명시적으로 설정하지 않습니다.
      // boundary 등이 자동으로 추가됩니다.
      'Authorization': `Bearer ${token}`,
      // CSRF 토큰이 필요하다면 defaultHeaders()와 유사하게 추가해야 할 수 있으나,
      // 파일 업로드의 경우 일반적인 JSON 요청과 CSRF 처리 방식이 다를 수 있습니다.
      // 백엔드 설정에 따라 X-XSRF-TOKEN 헤더가 필요 없을 수도 있습니다.
      // 만약 Spring Security의 CSRF 보호가 활성화되어 있고 세션 쿠키를 사용한다면,
      // credentials: 'include'와 함께 CSRF 토큰도 보내야 할 수 있습니다.
      // 하지만 JWT 토큰 기반 인증을 주로 사용한다면 CSRF 토큰이 필수는 아닐 수 있습니다.
      // 여기서는 JWT만 사용한다고 가정합니다.
      ...(Cookies.get('XSRF-TOKEN') ? { 'X-XSRF-TOKEN': Cookies.get('XSRF-TOKEN') } : {}) // 필요시 CSRF 토큰 추가
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `계약 업로드 실패: ${response.statusText} (상태 코드: ${response.status})`,
    }));
    throw new Error(errorData.message || `계약 업로드 실패: ${response.statusText}`);
  }
  return response.json();
};

// 로그인 (기존에 있던 함수)
export const loginApi = (email: string, password: string) =>
  fetch(`${BASE_URL}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: defaultHeaders(),
    body: JSON.stringify({ 
      email, 
      password    // ⚠️ 필드 이름을 password로 맞춰야 합니다
    }),
  }).then(res => {
    if (!res.ok) throw new Error(`로그인 실패: ${res.statusText}`);
    return res.json();
  });

export const signupApi = async (username: string, email: string, password: string) => {
  const res = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  return res.json();
};

export const getUserInfo = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:8080/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  };

export const getWebAuthnRegisterOptions = async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/webauthn/register/options`, {
      method: 'GET',
        credentials: 'include',    // 쿠키 포함
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }, // CSRF 토큰 헤더 + Content-Type
      });
      if (!res.ok) throw new Error(`등록 옵션 조회 실패: ${res.statusText}`);
      return res.json();
    };

export const verifyWebAuthnRegister = async (payload: any) => {
    const res = await fetch(`${BASE_URL}/webauthn/register/verify`, {
      method: 'POST',
      credentials: 'include',        // 쿠키 포함
      headers: defaultHeaders(),     // CSRF 토큰 헤더 + Content-Type
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`등록 검증 실패: ${res.statusText}`);
    return res.json();
  };

  export const getWebAuthnLoginOptions = async (email: string) => {
      const res = await fetch(
        `${BASE_URL}/webauthn/login/options?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: defaultHeaders(),
        }
      );
      if (!res.ok) throw new Error(`옵션 요청 실패: ${res.statusText}`);
      return res.json();
    };

export const verifyWebAuthnLogin = async (payload: {
    request: any;
    response: any;
  }) => {
    const res = await fetch(`${BASE_URL}/webauthn/login/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`WebAuthn 로그인 검증 실패: ${res.statusText}`);
    }
    return res.json();
  };

// 리프레시
export const refreshTokenApi = () =>
  fetch(`${BASE_URL}/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: defaultHeaders()
  }).then(r => r.json());

export const logoutApi = () =>
  fetch(`${BASE_URL}/logout`, {
    method: 'POST',
    credentials: 'include',     // HttpOnly 쿠키 전송
    headers: defaultHeaders(),  // CSRF 토큰 헤더 포함
  }).then(res => {
    if (!res.ok) throw new Error(`로그아웃 실패: ${res.statusText}`);
    return res.json();
  });

  export interface IContract {
    id: number;
    title: string;
    description?: string;
    createdByUserName: string;
    currentVersionNumber?: number;
    status: string;
    createdAt: string;
    updatedAt?: string;
    currentVersionId?: number; 
  }
  
  // ApiResponse 타입 정의 (백엔드 ApiResponse와 일치하도록)
  export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
  }
  
  // 수정된 getMyContractsApi 함수
  export const getMyContractsApi = async (searchTerm?: string): Promise<IContract[]> => {
    const token = localStorage.getItem('token');
    console.log('[api.ts] getMyContractsApi called. Token:', token, 'SearchTerm:', searchTerm);
    if (!token) {
      console.error('[api.ts] No auth token found for getMyContractsApi.');
      throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
    }
  
    let url = `${BASE_URL.replace('/auth', '/api')}/contracts/my`;
    if (searchTerm && searchTerm.trim() !== '') {
      url += `?search=${encodeURIComponent(searchTerm.trim())}`;
    }
    console.log('[api.ts] Fetching contracts from URL:', url);
  
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...defaultHeaders(),
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('[api.ts] getMyContractsApi response status:', response.status);

    const responseDataText = await response.text(); // 텍스트로 먼저 받고
    let responseData;
    try {
      responseData = JSON.parse(responseDataText); // JSON 파싱 시도
    } catch (e) {
      console.error('[api.ts] Failed to parse JSON response:', responseDataText, e);
      throw new Error(`서버 응답 파싱 실패: ${response.statusText}`);
    }
  
    console.log('[api.ts] getMyContractsApi raw response data:', responseData);
  
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `계약 목록 조회 실패: ${response.statusText}` }));
      throw new Error(errorData.message || `계약 목록 조회 실패: ${response.statusText}`);
    }
  
    const apiResponse: ApiResponse<IContract[]> = responseData; 
  if (!apiResponse.success) {
    console.warn('[api.ts] getMyContractsApi returned success:false. Message:', apiResponse.message);
    throw new Error(apiResponse.message || '계약 목록 조회에 실패했습니다.');
  }
  console.log('[api.ts] Successfully fetched contracts:', apiResponse.data);
  return apiResponse.data;
  };

  export const getContractPresignedUrlApi = async (versionId: number): Promise<string> => {
    const token = localStorage.getItem('token');
    console.log('[api.ts] getContractPresignedUrlApi called for versionId:', versionId);
  
    if (!token) {
      console.error('[api.ts] No auth token found for getContractPresignedUrlApi.');
      throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
    }
  
    const apiUrl = `${BASE_URL.replace('/auth', '/api')}/contracts/versions/${versionId}/file-url`;
    console.log('[api.ts] Fetching contract presigned URL from:', apiUrl);
  
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      console.log('[api.ts] getContractPresignedUrlApi response status:', response.status);
      const apiResponse: ApiResponse<string> = await response.json();
  
      if (!response.ok || !apiResponse.success || !apiResponse.data) {
        const errorMsg = apiResponse.message || `Presigned URL 요청 실패 (상태: ${response.status})`;
        console.error(`[api.ts] Failed to fetch presigned URL for version ${versionId}:`, errorMsg, apiResponse);
        throw new Error(errorMsg);
      }
      console.log('[api.ts] Received presigned URL:', apiResponse.data);
      return apiResponse.data;
    } catch (error) {
      console.error(`[api.ts] Error in getContractPresignedUrlApi for version ${versionId}:`, error);
      // 네트워크 오류 등으로 response.json() 자체가 실패할 수 있음
      if (error instanceof Error) throw error;
      throw new Error('계약서 URL을 가져오는 중 알 수 없는 오류가 발생했습니다.');
    }
  };


