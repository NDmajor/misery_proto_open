// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import Header from './components/Header';
import LeftAsideColumn from './components/LeftAsideColumn';
import PathBar from './components/PathBar';
import Tooltip from './components/Tooltip';
import { AContainer, AContent, AContentTable, AMain, Button } from './styles';
import getIcon from './utils/getIcon';
import { refreshTokenApi, getMyContractsApi, IContract } from './utils/api';
import { useNavigate } from 'react-router-dom';

import { useContractDetailModal } from './hooks/useContractDetailModal';
import ContractDetailModal from './components/ContractDetailModal/ContractDetailModal';

function App() {
  const [remainingTime, setRemainingTime] = useState<string>('');
  const navigate = useNavigate();

  const [myContracts, setMyContracts] = useState<IContract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState<boolean>(true);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const {
    isModalOpen: isContractDetailModalOpen,
    selectedContract,
    openModal: openContractDetailModal,
    closeModal: closeContractDetailModal,
  } = useContractDetailModal();

  const parseJwt = useCallback((token: string): { exp: number; sub?: string; } | null => {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("[App.tsx] Failed to parse JWT:", e);
      return null;
    }
  }, []);

  const performLogout = useCallback(() => {
    console.log("[App.tsx] Performing logout.");
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setMyContracts([]);
    setIsLoadingContracts(false); // 로딩 상태도 초기화
    setContractsError(null);     // 에러 상태도 초기화
    if (!['/login', '/signup'].includes(window.location.pathname) && !window.location.pathname.startsWith('/webauthn')) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;
    let isMounted = true; // 컴포넌트 마운트 상태 추적

    const attemptRefreshAndLoadContracts = async (currentSearchTerm: string) => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                console.log("[App.tsx] Attempting token refresh due to expiry or initial load.");
                const response = await refreshTokenApi();
                if (response.success && response.data && response.data.accessToken) {
                    if (!isMounted) return;
                    localStorage.setItem('token', response.data.accessToken);
                    console.log("[App.tsx] Token refreshed successfully. Fetching contracts.");
                    await fetchContractsCallback(currentSearchTerm, response.data.accessToken); // 새 토큰으로 즉시 로드
                } else {
                    console.warn("[App.tsx] Token refresh failed:", response.message);
                    if (isMounted) performLogout();
                }
            } catch (error) {
                console.error("[App.tsx] Error during token refresh:", error);
                if (isMounted) performLogout();
            }
        } else {
            console.log("[App.tsx] No refresh token found. Logging out.");
            if (isMounted) performLogout();
        }
    };


    const updateRemaining = () => {
      if (!isMounted) return;
      const token = localStorage.getItem('token');
      if (!token) {
        setRemainingTime('토큰 없음');
        if (isMounted) performLogout();
        return;
      }

      const payload = parseJwt(token);
      if (!payload) {
        setRemainingTime('토큰 파싱 오류');
        if (isMounted) performLogout();
        return;
      }

      const diff = payload.exp * 1000 - Date.now();
      if (diff <= 0) {
        setRemainingTime('만료됨');
        // 만료 시 리프레시 시도 (fetchContractsCallback 내부에서도 토큰을 사용하므로, 여기서 먼저 처리)
        attemptRefreshAndLoadContracts(searchTerm); // 현재 검색어로 재시도
      } else {
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setRemainingTime(`${minutes}분 ${seconds}초`);
      }
    };

    updateRemaining(); // 초기 실행
    // eslint-disable-next-line prefer-const
    timerId = setInterval(updateRemaining, 15000); // 체크 간격 15초

    return () => {
      isMounted = false;
      clearInterval(timerId);
    };
  }, [navigate, parseJwt, performLogout, searchTerm]); // searchTerm도 의존성에 추가 (리프레시 후 올바른 검색어로 로드)

  // 계약 목록 불러오기 콜백
  const fetchContractsCallback = useCallback(async (currentSearchTerm: string, currentToken?: string | null) => {
    const tokenToUse = currentToken || localStorage.getItem('token'); // 우선순위: 인자로 받은 토큰 > 로컬스토리지 토큰
    if (!tokenToUse) {
      console.log("[App.tsx] No token available for fetchContractsCallback.");
      setIsLoadingContracts(false);
      // performLogout(); // 여기서 호출하면 의도치 않은 로그아웃 발생 가능성, 토큰 체크 useEffect에 위임
      return;
    }

    console.log('[App.tsx] fetchContractsCallback triggered. SearchTerm:', currentSearchTerm);
    setIsLoadingContracts(true);
    setContractsError(null);
    try {
      // getMyContractsApi는 내부에서 localStorage.getItem('token')을 사용하므로,
      // currentToken을 인자로 넘겨 사용하는 방식은 api.ts 수정 필요.
      // 현재는 api.ts가 localStorage를 직접 사용하므로 currentToken 인자는 실제 사용 안됨.
      // 만약 api.ts를 수정했다면 아래와 같이 currentToken을 넘겨줄 수 있도록 getMyContractsApi 수정 필요
      const contracts = await getMyContractsApi(currentSearchTerm /*, tokenToUse */);
      console.log('[App.tsx] Contracts received by fetchContractsCallback:', contracts);
      setMyContracts(contracts);
    } catch (err: any) {
      console.error("[App.tsx] Error in fetchContractsCallback:", err);
      setContractsError(err.message || "계약 목록 로딩 중 오류 발생");
      setMyContracts([]);
      if (err.message?.includes("인증 토큰이 없습니다") || err.message?.includes("로그인이 필요합니다")) {
        console.warn("[App.tsx] Auth error during fetch, deferring to token check useEffect for logout.");
        // performLogout(); // 중복 호출 방지
      }
    } finally {
      setIsLoadingContracts(false);
    }
  }, []); // 의존성 최소화 (navigate는 performLogout으로 처리)

  // searchTerm이 변경될 때 계약 목록 다시 불러오기
  useEffect(() => {
    console.log(`[App.tsx] Search term changed to: "${searchTerm}", attempting to fetch contracts.`);
    fetchContractsCallback(searchTerm);
  }, [searchTerm, fetchContractsCallback]); // 초기 로드 및 searchTerm 변경 시

  // 수동 토큰 갱신 핸들러
  const handleRefreshManual = async () => {
    // ... (이전 답변의 handleRefreshManual 로직과 유사하게, 성공 시 fetchContractsCallback 호출) ...
    try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          alert('리프레시 토큰이 없어 토큰을 갱신할 수 없습니다. 다시 로그인해주세요.');
          performLogout();
          return;
        }
        console.log('[App.tsx] Attempting manual token refresh.');
        const response = await refreshTokenApi();
        if (response.success && response.data && response.data.accessToken) {
          localStorage.setItem('token', response.data.accessToken);
          alert('토큰이 성공적으로 갱신되었습니다.');
          const newTokenPayload = parseJwt(response.data.accessToken);
          if (newTokenPayload) {
              const diff = newTokenPayload.exp * 1000 - Date.now();
              const m = Math.floor((diff % 3600000) / 60000);
              const s = Math.floor((diff % 60000) / 1000);
              setRemainingTime(`${m}분 ${s}초 (수동 갱신)`);
          }
          await fetchContractsCallback(searchTerm, response.data.accessToken); // 새 토큰으로 즉시 계약 로드
        } else {
          alert(`토큰 갱신에 실패했습니다: ${response.message || '응답 데이터 오류'}`);
          performLogout();
        }
      } catch (error: any) {
        console.error("Manual token refresh failed:", error);
        alert(`토큰 갱신 중 오류가 발생했습니다: ${error.message || '서버 통신 실패'}`);
        performLogout();
      }
  };

  const handleWebAuthnRegisterClick = () => navigate('/webauthn/register');
  const handleSearchTermChange = (newSearchTerm: string) => setSearchTerm(newSearchTerm);

  const handleContractClick = (contract: IContract) => {
    console.log(`[App.tsx] Contract row (ID: ${contract.id}, VersionID: ${contract.currentVersionId}) clicked.`);
    openContractDetailModal(contract);
  };

  return (
    <AContainer>
      <Header onSearchTermChange={handleSearchTermChange} />
      <LeftAsideColumn />
      <AMain>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', alignItems: 'center', gap: '10px', borderBottom: '1px solid #eee', marginBottom: '10px' }}>
          <Button onClick={handleWebAuthnRegisterClick}>PassKey 등록</Button>
          <Button onClick={handleRefreshManual}>토큰 갱신</Button>
          <span style={{ fontSize: '0.9em', color: '#333' }}>만료까지: {remainingTime}</span>
        </div>
        <PathBar />
        <AContent>
          {isLoadingContracts && <p style={{ padding: '20px', textAlign: 'center' }}>계약 목록 로딩 중...</p>}
          {contractsError && <p style={{ padding: '20px', textAlign: 'center', color: 'red' }}>오류: {contractsError}</p>}
          {!isLoadingContracts && !contractsError && myContracts.length === 0 && (
            <p style={{ padding: '20px', textAlign: 'center' }}>
              {searchTerm ? `'${searchTerm}' 검색 결과 없음` : '표시할 계약이 없습니다.'}
            </p>
          )}
          {!isLoadingContracts && !contractsError && myContracts.length > 0 && (
            <AContentTable>
              <thead>
                <tr>
                  <th>이름 (제목)</th>
                  <th>소유자</th>
                  <th>상태</th>
                  <th>버전 (ID)</th>
                  <th>생성일</th>
                </tr>
              </thead>
              <tbody>
                {myContracts.map(contract => (
                  <tr
                    key={contract.id}
                    onClick={() => handleContractClick(contract)}
                    style={{ cursor: 'pointer' }}
                    title={`계약 ID: ${contract.id} 상세 보기`}
                  >
                    <td>
                      <div><img src={getIcon('application/pdf')} alt="pdf icon" style={{ width: '20px', height: '20px' }}/></div>
                      <span>{contract.title}</span>
                    </td>
                    <td>{contract.createdByUserName}</td>
                    <td>{contract.status}</td>
                    <td>
                      {contract.currentVersionNumber ? `Ver. ${contract.currentVersionNumber}` : '-'}
                      {contract.currentVersionId ? ` (ID: ${contract.currentVersionId})` : ''}
                    </td>
                    <td>{moment(contract.createdAt).format('YYYY-MM-DD HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </AContentTable>
          )}
        </AContent>
      </AMain>
      <Tooltip />
      {/* selectedContract가 있을 때만 Modal을 렌더링하거나, Modal 내부에서 contract prop이 null일 때의 처리를 강화 */}
      {selectedContract && isContractDetailModalOpen && (
          <ContractDetailModal
            isOpen={isContractDetailModalOpen}
            onClose={closeContractDetailModal}
            contract={selectedContract}
          />
      )}
    </AContainer>
  );
}

export default App;