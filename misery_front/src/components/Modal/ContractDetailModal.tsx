import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import moment from 'moment';

// Modal 스타일 관련 임포트
import CustomModal from './Modal'
import {
  ModalHeader, ModalLogo, LogoCircle, CloseButton, ModalBody, ModalTitle,
  ModalDesc, ModalFooter, FooterButton, InfoDisplay, InputGroup, StyledLabel
} from './styles'

// API 함수 임포트 (실제로는 utils/api에서 임포트)
import { getContractDetails, signContract, getCurrentUser, downloadContractFile, downloadFileDirectly, verifyContractIntegrity } from '../../utils/api';

// 타입 정의
interface ContractDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: number | null;
  onContractUpdate?: () => void; // 계약서 업데이트 후 콜백
}

interface ContractDetail {
  id: number;
  title: string;
  description?: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  createdAt: string;
  updatedAt?: string;
  createdBy: {
    id: number;
    username: string;
    email: string;
  };
  updatedBy?: {
    id: number;
    username: string;
    email: string;
  };
  currentVersion?: {
    id: number;
    versionNumber: number;
    filePath: string;
    fileHash: string;
    status: 'PENDING_SIGNATURE' | 'SIGNED' | 'ARCHIVED';
    createdAt: string;
    storageProvider: string;
    bucketName: string;
    signatures: Array<{
      signerUuid: string;
      signerUsername: string;
      signedAt: string;
      signatureHash: string;
    }>;
  };
  participants: Array<{
    userUuid: string;
    username: string;
    email: string;
    role: 'INITIATOR' | 'COUNTERPARTY';
  }>;
  versionHistory: Array<{
    id: number;
    versionNumber: number;
    status: string;
    createdAt: string;
    signatures: Array<{
      signerUuid: string;
      signerUsername: string;
      signedAt: string;
    }>;
  }>;
}

const ContractDetailModal: React.FC<ContractDetailModalProps> = ({
  isOpen,
  onClose,
  contractId,
  onContractUpdate,
}) => {
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [signing, setSigning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showPdfViewer, setShowPdfViewer] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showVerificationResult, setShowVerificationResult] = useState<boolean>(false);

  // 현재 사용자 정보 로드
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await getCurrentUser();
        if (response.success) {
          setCurrentUser(response.data);
        }
      } catch (err) {
        console.error('현재 사용자 정보 로드 실패:', err);
      }
    };

    if (isOpen) {
      loadCurrentUser();
    }
  }, [isOpen]);

  // 계약서 상세 정보 로드
  useEffect(() => {
    if (isOpen && contractId) {
      loadContractDetails();
    }
  }, [isOpen, contractId]);

  const loadContractDetails = async () => {
    if (!contractId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await getContractDetails(contractId);
      if (response.success) {
        setContract(response.data);
      } else {
        setError(response.message || '계약서 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('계약서 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('계약서 상세 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // PDF 미리보기 URL 생성
  const generatePdfUrl = async (filePath: string) => {
    try {
      setPdfLoading(true);
      
      // 새로운 API 함수 사용
      const blob = await downloadContractFile(filePath);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setShowPdfViewer(true);
    } catch (err) {
      console.error('PDF 로드 오류:', err);
      alert('PDF 파일을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setPdfLoading(false);
    }
  };

  // PDF 다운로드
  const downloadPdf = async (filePath: string, fileName: string) => {
    try {
      // 새로운 API 함수 사용
      await downloadFileDirectly(filePath, fileName || `계약서_${contract?.title || 'document'}.pdf`);
    } catch (err) {
      console.error('다운로드 오류:', err);
      alert('파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 무결성 검증
  const handleVerifyIntegrity = async () => {
    if (!contract || !contract.currentVersion) {
      alert('현재 버전 정보가 없습니다.');
      return;
    }

    setVerifying(true);
    
    try {
      const response = await verifyContractIntegrity(contract.id, contract.currentVersion.versionNumber);
      if (response.success) {
        setVerificationResult(response.data);
        setShowVerificationResult(true);
      } else {
        alert(response.message || '무결성 검증에 실패했습니다.');
      }
    } catch (err) {
      console.error('무결성 검증 오류:', err);
      alert('무결성 검증 중 오류가 발생했습니다.');
    } finally {
      setVerifying(false);
    }
  };

  // 계약서 서명
  const handleSign = async () => {
    if (!contractId || !contract) return;
    
    // 서명 확인 다이얼로그
    const confirmSign = window.confirm(
      `"${contract.title}" 계약서에 서명하시겠습니까?\n\n서명 후에는 취소할 수 없습니다.`
    );
    
    if (!confirmSign) return;
    
    setSigning(true);
    
    try {
      const response = await signContract(contractId);
      if (response.success) {
        alert('계약서에 성공적으로 서명했습니다.');
        await loadContractDetails(); // 계약서 정보 새로고침
        if (onContractUpdate) {
          onContractUpdate(); // 부모 컴포넌트에 업데이트 알림
        }
      } else {
        alert(response.message || '서명에 실패했습니다.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '서명 중 오류가 발생했습니다.';
      alert(errorMessage);
      console.error('서명 오류:', err);
    } finally {
      setSigning(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setContract(null);
    setError(null);
    setCurrentUser(null);
    setShowPdfViewer(false);
    setVerificationResult(null);
    setShowVerificationResult(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    onClose();
  };

  // PDF 뷰어 닫기
  const closePdfViewer = () => {
    setShowPdfViewer(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  // 현재 사용자가 이미 서명했는지 확인
  const hasUserSigned = () => {
    if (!contract || !contract.currentVersion || !currentUser) {
      return false;
    }
    
    const userUuid = currentUser.uuid || currentUser.id?.toString();
    
    const signatureMatches = contract.currentVersion.signatures.map(signature => {
      const uuidMatch = signature.signerUuid === userUuid;
      const idMatch = signature.signerUuid === currentUser.id?.toString();
      return uuidMatch || idMatch;
    });
    
    return signatureMatches.some(match => match);
  };

  // 현재 사용자가 참여자인지 확인
  const isUserParticipant = () => {
    if (!contract || !currentUser) return false;
    
    const isCreator = contract.createdBy.id === currentUser.id;
    const userUuid = currentUser.uuid || currentUser.id?.toString();
    const isParticipant = contract.participants.some(participant => 
      participant.userUuid === userUuid || 
      participant.userUuid === currentUser.id?.toString()
    );
    
    return isCreator || isParticipant;
  };

  // 현재 사용자가 서명할 수 있는지 확인
  const canSign = () => {
    if (!contract || !contract.currentVersion || !currentUser) return false;
    if (contract.status !== 'OPEN') return false;
    if (contract.currentVersion.status !== 'PENDING_SIGNATURE') return false;
    if (hasUserSigned()) return false;
    if (!isUserParticipant()) return false;
    
    return true;
  };

  // 현재 사용자의 서명 정보 가져오기
  const getCurrentUserSignature = () => {
    if (!contract || !contract.currentVersion || !currentUser) return null;
    
    const userUuid = currentUser.uuid || currentUser.id?.toString();
    if (!userUuid) return null;
    
    return contract.currentVersion.signatures.find(signature => {
      return signature.signerUuid === userUuid || 
             signature.signerUuid === currentUser.id?.toString();
    });
  };

  // 서명 상태에 따른 메시지와 스타일 결정
  const getSigningStatusDisplay = () => {
    if (!contract || !currentUser) return null;
    
    if (!isUserParticipant()) {
      return {
        type: 'info',
        title: 'ℹ️ 참여자 아님',
        message: '이 계약서의 참여자가 아닙니다.',
        backgroundColor: '#fff3e0',
        borderColor: '#ff9800',
        textColor: '#f57c00'
      };
    }

    if (hasUserSigned()) {
      const userSignature = getCurrentUserSignature();
      return {
        type: 'success',
        title: '✅ 서명 완료',
        message: userSignature 
          ? `${moment(userSignature.signedAt).format('YYYY년 MM월 DD일 HH:mm')}에 서명을 완료했습니다.`
          : '이미 서명을 완료했습니다.',
        backgroundColor: '#e8f5e8',
        borderColor: '#4caf50',
        textColor: '#2e7d32'
      };
    }
    
    if (contract.status === 'CLOSED') {
      return {
        type: 'info',
        title: 'ℹ️ 계약 완료',
        message: '이미 완료된 계약서입니다.',
        backgroundColor: '#e3f2fd',
        borderColor: '#2196f3',
        textColor: '#1976d2'
      };
    }
    
    if (contract.status === 'CANCELLED') {
      return {
        type: 'warning',
        title: '⚠️ 계약 취소',
        message: '취소된 계약서입니다.',
        backgroundColor: '#ffebee',
        borderColor: '#f44336',
        textColor: '#d32f2f'
      };
    }
    
    if (contract.currentVersion?.status === 'SIGNED') {
      return {
        type: 'info',
        title: 'ℹ️ 서명 완료',
        message: '모든 서명이 완료된 계약서입니다.',
        backgroundColor: '#e8f5e8',
        borderColor: '#4caf50',
        textColor: '#2e7d32'
      };
    }
    
    if (contract.currentVersion?.status === 'ARCHIVED') {
      return {
        type: 'info',
        title: 'ℹ️ 보관됨',
        message: '보관된 버전입니다.',
        backgroundColor: '#f5f5f5',
        borderColor: '#9e9e9e',
        textColor: '#666'
      };
    }

    if (canSign()) {
      return {
        type: 'canSign',
        title: '✓ 서명 가능',
        message: '이 계약서에 서명할 수 있습니다.',
        backgroundColor: '#e8f5e8',
        borderColor: '#4caf50',
        textColor: '#2e7d32'
      };
    }

    return null;
  };

  const statusDisplay = getSigningStatusDisplay();

  // 상태 텍스트 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'OPEN': return '진행중';
      case 'CLOSED': return '완료';
      case 'CANCELLED': return '취소됨';
      case 'PENDING_SIGNATURE': return '서명 대기';
      case 'SIGNED': return '서명 완료';
      case 'ARCHIVED': return '보관됨';
      default: return status;
    }
  };

  // 상태 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
      case 'PENDING_SIGNATURE':
        return '#1976d2';
      case 'CLOSED':
      case 'SIGNED':
        return '#388e3c';
      case 'CANCELLED':
        return '#d32f2f';
      case 'ARCHIVED':
        return '#666';
      default:
        return '#666';
    }
  };

  // 역할 텍스트 변환
  const getRoleText = (role: string) => {
    switch (role) {
      case 'INITIATOR': return '계약자';
      case 'COUNTERPARTY': return '피계약자';
      default: return role;
    }
  };

  // 검증 상태 텍스트 변환
  const getVerificationStatusText = (status: string) => {
    switch (status) {
      case 'SUCCESS': return '✅ 성공';
      case 'FAILED': return '❌ 실패';
      case 'DATA_NOT_FOUND': return '⚠️ 데이터 없음';
      case 'ERROR': return '🔴 오류';
      case 'NOT_CHECKED': return '⏸️ 검사 안함';
      default: return status;
    }
  };

  // 검증 상태 색상 반환
  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return { background: '#e8f5e8', border: '#4caf50' };
      case 'FAILED':
        return { background: '#ffebee', border: '#f44336' };
      case 'DATA_NOT_FOUND':
        return { background: '#fff3e0', border: '#ff9800' };
      case 'ERROR':
        return { background: '#ffebee', border: '#f44336' };
      case 'NOT_CHECKED':
        return { background: '#f5f5f5', border: '#9e9e9e' };
      default:
        return { background: '#f5f5f5', border: '#e0e0e0' };
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={handleClose}
        style={CustomModal}
        contentLabel="계약서 상세"
      >
        <ModalHeader>
          <ModalLogo>
            <LogoCircle>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            </LogoCircle>
          </ModalLogo>
          <CloseButton type="button" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
            </svg>
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              계약서 정보를 불러오는 중...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#d32f2f' }}>
              {error}
            </div>
          ) : contract ? (
            <>
              <ModalTitle>{contract.title}</ModalTitle>
              
              {/* PDF 관련 버튼들 */}
              {contract.currentVersion && (
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={() => generatePdfUrl(contract.currentVersion!.filePath)}
                    disabled={pdfLoading}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: pdfLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {pdfLoading ? (
                      '로딩 중...'
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                        </svg>
                        PDF 미리보기
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => downloadPdf(
                      contract.currentVersion!.filePath, 
                      `${contract.title}_v${contract.currentVersion!.versionNumber}.pdf`
                    )}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#388e3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      <path d="M12,11L16,15H13V19H11V15H8L12,11Z" />
                    </svg>
                    PDF 다운로드
                  </button>

                  <button
                    onClick={handleVerifyIntegrity}
                    disabled={verifying}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: verifying ? '#ccc' : '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: verifying ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {verifying ? (
                      '검증 중...'
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23,12L20.56,9.22L20.9,5.54L17.29,4.72L15.4,1.54L12,3L8.6,1.54L6.71,4.72L3.1,5.53L3.44,9.21L1,12L3.44,14.78L3.1,18.47L6.71,19.29L8.6,22.47L12,21L15.4,22.46L17.29,19.28L20.9,18.46L20.56,14.78L23,12M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
                        </svg>
                        무결성 검증
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 계약서 기본 정보 */}
              <InfoDisplay style={{ marginBottom: '1rem' }}>
                <strong>상태:</strong> 
                <span style={{ color: getStatusColor(contract.status), marginLeft: '8px' }}>
                  {getStatusText(contract.status)}
                </span>
              </InfoDisplay>

              {contract.description && (
                <InfoDisplay style={{ marginBottom: '1rem' }}>
                  <strong>설명:</strong> {contract.description}
                </InfoDisplay>
              )}

              <InfoDisplay style={{ marginBottom: '1rem' }}>
                <strong>생성일:</strong> {moment(contract.createdAt).format('YYYY년 MM월 DD일 HH:mm')}
              </InfoDisplay>

              <InfoDisplay style={{ marginBottom: '1rem' }}>
                <strong>생성자:</strong> {contract.createdBy.username} ({contract.createdBy.email})
              </InfoDisplay>

              {/* 현재 버전 정보 */}
              {contract.currentVersion && (
                <>
                  <div style={{ 
                    borderTop: '1px solid #e5e5e5', 
                    paddingTop: '1rem', 
                    marginTop: '1rem' 
                  }}>
                    <h3 style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: 600, 
                      marginBottom: '0.5rem',
                      color: '#333'
                    }}>
                      현재 버전 (v{contract.currentVersion.versionNumber})
                    </h3>
                    
                    <InfoDisplay style={{ marginBottom: '0.5rem' }}>
                      <strong>상태:</strong> 
                      <span style={{ color: getStatusColor(contract.currentVersion.status), marginLeft: '8px' }}>
                        {getStatusText(contract.currentVersion.status)}
                      </span>
                    </InfoDisplay>

                    <InfoDisplay style={{ marginBottom: '0.5rem' }}>
                      <strong>업로드일:</strong> {moment(contract.currentVersion.createdAt).format('YYYY년 MM월 DD일 HH:mm')}
                    </InfoDisplay>

                    <InfoDisplay style={{ marginBottom: '0.5rem' }}>
                      <strong>파일 해시:</strong> 
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.8rem', 
                        background: '#f5f5f5',
                        padding: '2px 4px',
                        borderRadius: '2px',
                        marginLeft: '8px'
                      }}>
                        {contract.currentVersion.fileHash.substring(0, 16)}...
                      </span>
                    </InfoDisplay>
                  </div>
                </>
              )}

              {/* 참여자 목록 */}
              {contract.participants.length > 0 && (
                <div style={{ 
                  borderTop: '1px solid #e5e5e5', 
                  paddingTop: '1rem', 
                  marginTop: '1rem' 
                }}>
                  <h3 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 600, 
                    marginBottom: '0.5rem',
                    color: '#333'
                  }}>
                    참여자 ({contract.participants.length}명)
                  </h3>
                  
                  {contract.participants.map((participant, index) => (
                    <InfoDisplay key={participant.userUuid} style={{ marginBottom: '0.5rem' }}>
                      <strong>{getRoleText(participant.role)}:</strong> 
                      {participant.username} ({participant.email})
                    </InfoDisplay>
                  ))}
                </div>
              )}

              {/* 서명 현황 */}
              {contract.currentVersion && contract.currentVersion.signatures.length > 0 && (
                <div style={{ 
                  borderTop: '1px solid #e5e5e5', 
                  paddingTop: '1rem', 
                  marginTop: '1rem' 
                }}>
                  <h3 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 600, 
                    marginBottom: '0.5rem',
                    color: '#333'
                  }}>
                    서명 현황 ({contract.currentVersion.signatures.length}명)
                  </h3>
                  
                  {contract.currentVersion.signatures.map((signature, index) => {
                    const userUuid = currentUser?.uuid || currentUser?.id?.toString();
                    const isCurrentUserSignature = signature.signerUuid === userUuid || 
                                                  signature.signerUuid === currentUser?.id?.toString();
                    
                    return (
                      <InfoDisplay key={signature.signerUuid} style={{ marginBottom: '0.5rem' }}>
                        <strong>{signature.signerUsername}:</strong> 
                        {moment(signature.signedAt).format('YYYY년 MM월 DD일 HH:mm')}에 서명
                        {currentUser && isCurrentUserSignature && (
                          <span style={{ 
                            color: '#388e3c', 
                            fontWeight: 'bold', 
                            marginLeft: '8px' 
                          }}>
                            (본인)
                          </span>
                        )}
                      </InfoDisplay>
                    );
                  })}
                </div>
              )}

              {/* 무결성 검증 결과 */}
              {showVerificationResult && verificationResult && (
                <div style={{ 
                  borderTop: '1px solid #e5e5e5', 
                  paddingTop: '1rem', 
                  marginTop: '1rem' 
                }}>
                  <h3 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 600, 
                    marginBottom: '0.5rem',
                    color: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={verificationResult.overallSuccess ? '#4caf50' : '#f44336'}>
                      <path d="M23,12L20.56,9.22L20.9,5.54L17.29,4.72L15.4,1.54L12,3L8.6,1.54L6.71,4.72L3.1,5.53L3.44,9.21L1,12L3.44,14.78L3.1,18.47L6.71,19.29L8.6,22.47L12,21L15.4,22.46L17.29,19.28L20.9,18.46L20.56,14.78L23,12M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
                    </svg>
                    무결성 검증 결과
                    <button
                      onClick={() => setShowVerificationResult(false)}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#666'
                      }}
                    >
                      ✕
                    </button>
                  </h3>
                  
                  {/* 전체 검증 결과 */}
                  <div style={{
                    padding: '12px',
                    background: verificationResult.overallSuccess ? '#e8f5e8' : '#ffebee',
                    border: `1px solid ${verificationResult.overallSuccess ? '#4caf50' : '#f44336'}`,
                    borderRadius: '4px',
                    marginBottom: '1rem'
                  }}>
                    <strong style={{ color: verificationResult.overallSuccess ? '#2e7d32' : '#d32f2f' }}>
                      {verificationResult.overallSuccess ? '✅ 검증 성공' : '❌ 검증 실패'}
                    </strong>
                    <br />
                    <span style={{ fontSize: '0.875rem' }}>
                      {verificationResult.message}
                    </span>
                    <br />
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>
                      검증 시간: {moment(verificationResult.verifiedAt).format('YYYY년 MM월 DD일 HH:mm:ss')}
                    </span>
                  </div>

                  {/* DB 검증 결과 */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#333' }}>
                      1. DB 기록 무결성 검증
                    </h4>
                    <div style={{
                      padding: '8px 12px',
                      background: getVerificationStatusColor(verificationResult.dbVerification.status).background,
                      border: `1px solid ${getVerificationStatusColor(verificationResult.dbVerification.status).border}`,
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}>
                      <strong>{getVerificationStatusText(verificationResult.dbVerification.status)}</strong>
                      <br />
                      {verificationResult.dbVerification.details}
                      {verificationResult.dbVerification.discrepancies && verificationResult.dbVerification.discrepancies.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <strong>불일치 항목:</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                            {verificationResult.dbVerification.discrepancies.map((item: string, index: number) => (
                              <li key={index} style={{ fontSize: '0.8rem' }}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 블록체인 검증 결과 */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#333' }}>
                      2. 블록체인 데이터 비교 검증
                    </h4>
                    <div style={{
                      padding: '8px 12px',
                      background: getVerificationStatusColor(verificationResult.blockchainVerification.status).background,
                      border: `1px solid ${getVerificationStatusColor(verificationResult.blockchainVerification.status).border}`,
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}>
                      <strong>{getVerificationStatusText(verificationResult.blockchainVerification.status)}</strong>
                      <br />
                      {verificationResult.blockchainVerification.details}
                      {verificationResult.blockchainVerification.discrepancies && verificationResult.blockchainVerification.discrepancies.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <strong>불일치 항목:</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                            {verificationResult.blockchainVerification.discrepancies.map((item: string, index: number) => (
                              <li key={index} style={{ fontSize: '0.8rem' }}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 서명 상태 메시지 */}
              {currentUser && statusDisplay && (
                <div style={{ 
                  borderTop: '1px solid #e5e5e5', 
                  paddingTop: '1rem', 
                  marginTop: '1rem' 
                }}>
                  <div style={{
                    padding: '12px',
                    background: statusDisplay.backgroundColor,
                    border: `1px solid ${statusDisplay.borderColor}`,
                    borderRadius: '4px',
                    color: statusDisplay.textColor
                  }}>
                    <strong>{statusDisplay.title}</strong><br />
                    {statusDisplay.message}
                  </div>
                </div>
              )}

            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              계약서를 선택해주세요.
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <FooterButton type="button" onClick={handleClose}>
            닫기
          </FooterButton>
          
          {/* 서명 가능한 경우에만 서명 버튼 표시 */}
          {contract && currentUser && canSign() && (
            <FooterButton 
              type="button" 
              onClick={handleSign}
              disabled={signing}
              style={{
                backgroundColor: signing ? '#ccc' : '#4caf50',
                borderColor: signing ? '#ccc' : '#4caf50'
              }}
            >
              {signing ? '서명 중...' : '서명하기'}
            </FooterButton>
          )}
          
          {/* 이미 서명한 경우 서명 완료 버튼 표시 (비활성화) */}
          {contract && currentUser && hasUserSigned() && !canSign() && (
            <FooterButton 
              type="button" 
              disabled={true}
              style={{
                backgroundColor: '#4caf50',
                borderColor: '#4caf50',
                opacity: 0.7,
                cursor: 'not-allowed'
              }}
            >
              ✅ 서명 완료
            </FooterButton>
          )}
        </ModalFooter>
      </Modal>

      {/* PDF 뷰어 모달 */}
      {showPdfViewer && pdfUrl && (
        <Modal
          isOpen={showPdfViewer}
          onRequestClose={closePdfViewer}
          style={{
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              zIndex: 2000,
            },
            content: {
              top: '5%',
              left: '5%',
              right: '5%',
              bottom: '5%',
              border: 'none',
              borderRadius: '8px',
              padding: '0',
            },
          }}
          contentLabel="PDF 미리보기"
        >
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* PDF 뷰어 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid #e5e5e5',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                {contract?.title} - PDF 미리보기
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => contract?.currentVersion && downloadPdf(
                    contract.currentVersion.filePath, 
                    `${contract.title}_v${contract.currentVersion.versionNumber}.pdf`
                  )}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#388e3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  다운로드
                </button>
                <button
                  onClick={closePdfViewer}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  닫기
                </button>
              </div>
            </div>

            {/* PDF 뷰어 본문 */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <iframe
                src={pdfUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title="PDF 미리보기"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default ContractDetailModal;