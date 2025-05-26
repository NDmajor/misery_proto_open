// src/components/ContractDetailModal/ContractDetailModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import moment from 'moment';
import styled from 'styled-components';
import { IContract, getContractPresignedUrlApi } from '../../utils/api';
import CustomModalStyles from '../Modal/Modal';
import {
  ModalHeader, ModalLogo, CloseButton, ModalBody, ModalTitle,
  ModalFooter, FooterButton, InfoDisplay,
} from '../Modal/styles';
import logoImg from '../../assets/logo.png';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

const PDFJS_DIST_VERSION = "4.8.69";

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`; 
console.log('[ContractDetailModal] PDF.js worker SRC set to local:', pdfjs.GlobalWorkerOptions.workerSrc);

// Styled Components (이전 답변과 동일)
// ModalBodyStyled, InfoSection, PdfSection, PdfControls, PdfViewerWrapper, LoadingOrErrorDisplay

// ... (Styled Components 정의는 이전 답변과 동일하게 유지)
const ModalBodyStyled = styled(ModalBody)`
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
  padding: 1rem 1.5rem 0;
`;

const InfoSection = styled.div`
  margin-bottom: 15px;
  padding-right: 10px;
  max-height: 25vh;
  overflow-y: auto;
  font-size: 0.9rem;
`;

const PdfSection = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: 10px;
  border-top: 1px solid #eee;
  padding-top: 10px;
`;

const PdfControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 5px;
  background-color: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.85em;

  button {
    padding: 5px 10px;
    border: 1px solid #ccc;
    background-color: #fff;
    cursor: pointer;
    border-radius: 4px;
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    &:hover:not(:disabled) {
      background-color: #e9e9e9;
    }
  }
  span {
    margin: 0 10px;
    font-weight: 500;
  }
`;

const PdfViewerWrapper = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  background-color: #d1d1d1;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;

  .react-pdf__Document {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .react-pdf__Page {
    margin-bottom: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    background-color: white;
  }

  .react-pdf__Page__canvas,
  .react-pdf__Page__textContent,
  .react-pdf__Page__annotations {
    height: auto !important;
  }
`;

const LoadingOrErrorDisplay = styled.p`
  text-align: center;
  padding: 40px 20px;
  font-size: 1em;
  color: #555;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center; /* 텍스트 중앙 정렬 */
`;


interface ContractDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: IContract | null;
}

const ContractDetailModal: React.FC<ContractDetailModalProps> = ({
  isOpen,
  onClose,
  contract,
}) => {
  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [pdfDisplayWidth, setPdfDisplayWidth] = useState<number>(500);

  const pdfViewerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculatePdfWidth = () => {
      if (pdfViewerWrapperRef.current) {
        const availableWidth = pdfViewerWrapperRef.current.offsetWidth - 20;
        console.log('[ContractDetailModal] Calculated PDF display width:', availableWidth);
        setPdfDisplayWidth(availableWidth > 0 ? availableWidth : 500);
      }
    };
    if (isOpen) {
      const timeoutId = setTimeout(calculatePdfWidth, 50);
      window.addEventListener('resize', calculatePdfWidth);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', calculatePdfWidth);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && contract) { // contract가 null이 아닌지 먼저 확인
      if (contract.currentVersionId) { // currentVersionId가 있을 때만 PDF 로드 시도
        console.log(`[ContractDetailModal] useEffect for PDF load. Contract ID: ${contract.id}, Version ID: ${contract.currentVersionId}`);
        setIsLoadingPdf(true);
        setPdfError(null);
        setPdfFileUrl(null);
        setCurrentPage(1);
        setNumPages(null);

        getContractPresignedUrlApi(contract.currentVersionId)
          .then(url => {
            console.log(`[ContractDetailModal] Presigned PDF URL for version ${contract.currentVersionId}: ${url}`);
            setPdfFileUrl(url);
          })
          .catch(err => {
            console.error(`[ContractDetailModal] Error fetching PDF URL for version ${contract.currentVersionId}:`, err);
            setPdfError(err.message || '계약서 파일을 불러오는 데 실패했습니다.');
          })
          .finally(() => {
            setIsLoadingPdf(false);
          });
      } else {
        // currentVersionId가 없는 경우
        console.warn(`[ContractDetailModal] Contract (ID: ${contract.id}) has no currentVersionId. Cannot load PDF.`);
        setPdfError("이 계약에는 유효한 PDF 버전 정보가 없습니다.");
        setIsLoadingPdf(false);
        setPdfFileUrl(null); // 명시적으로 null 처리
        setNumPages(null);
      }
    } else if (!isOpen) {
      // console.log('[ContractDetailModal] Modal closed, resetting PDF states.');
      setPdfFileUrl(null);
      setNumPages(null);
      setPdfError(null);
      setIsLoadingPdf(false);
      setCurrentPage(1);
    }
  }, [isOpen, contract]);

  function onDocumentLoadSuccess({ numPages: loadedNumPages }: { numPages: number }) {
    console.log(`[ContractDetailModal] PDF document loaded successfully. Total pages: ${loadedNumPages}. URL: ${pdfFileUrl}`);
    setNumPages(loadedNumPages);
    setCurrentPage(1);
    setPdfError(null); 
  }

  function onDocumentLoadError(error: Error) {
    console.error(`[ContractDetailModal] Error loading PDF document from URL ${pdfFileUrl}:`, error);
    setPdfError(`PDF 문서 로드 중 오류가 발생했습니다: ${error.message}. URL: ${pdfFileUrl}`);
  }

  const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => (numPages ? Math.min(numPages, prev + 1) : prev));

  // App.tsx에서 selectedContract가 null일 때 isOpen을 false로 만들기 때문에 이 조건은 거의 발생 안함
  if (!isOpen) return null;
  // contract가 null인데 모달이 열리려고 하면 (이론상 App.tsx에서 방지됨)
  if (!contract && isOpen) {
    console.warn("[ContractDetailModal] isOpen is true but contract is null. This should not happen if App.tsx logic is correct.");
    return (
        <Modal isOpen={true} onRequestClose={onClose} style={CustomModalStyles} contentLabel="오류" ariaHideApp={false}>
            <ModalHeader><ModalLogo><img src={logoImg} alt="Logo" style={{ height: '28px' }} /></ModalLogo><CloseButton type="button" onClick={onClose}>X</CloseButton></ModalHeader>
            <ModalBodyStyled><LoadingOrErrorDisplay>선택된 계약 정보가 없습니다.</LoadingOrErrorDisplay></ModalBodyStyled>
            <ModalFooter><FooterButton type="button" onClick={onClose}>닫기</FooterButton></ModalFooter>
        </Modal>
    );
  }


  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} style={CustomModalStyles} contentLabel="계약 상세 정보" ariaHideApp={false}>
      <ModalHeader>
        <ModalLogo><img src={logoImg} alt="Misery Logo" style={{ height: '28px' }} /></ModalLogo>
        <CloseButton type="button" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </CloseButton>
      </ModalHeader>
      <ModalBodyStyled>
        <InfoSection>
          <ModalTitle>{contract?.title || '계약 정보 없음'}</ModalTitle>
          <InfoDisplay><strong>계약 ID:</strong> {contract?.id}</InfoDisplay>
          <InfoDisplay><strong>설명:</strong> {contract?.description || 'N/A'}</InfoDisplay>
          <InfoDisplay><strong>생성자:</strong> {contract?.createdByUserName}</InfoDisplay>
          <InfoDisplay><strong>상태:</strong> {contract?.status}</InfoDisplay>
          <InfoDisplay><strong>현재 버전:</strong> Ver. {contract?.currentVersionNumber || '-'} (ID: {contract?.currentVersionId || 'N/A'})</InfoDisplay>
          <InfoDisplay><strong>생성일:</strong> {contract?.createdAt ? moment(contract.createdAt).format('YYYY년 MM월 DD일 HH:mm') : 'N/A'}</InfoDisplay>
          {contract?.updatedAt && <InfoDisplay><strong>수정일:</strong> {moment(contract.updatedAt).format('YYYY년 MM월 DD일 HH:mm')}</InfoDisplay>}
        </InfoSection>
        <PdfSection>
          <h5 style={{ margin: '0 0 5px 5px', fontSize: '1.1em', fontWeight: 600 }}>계약서 미리보기</h5>
          {isLoadingPdf && <LoadingOrErrorDisplay>PDF 파일 로딩 중...</LoadingOrErrorDisplay>}
          {pdfError && <LoadingOrErrorDisplay style={{ color: 'red' }}>{pdfError}</LoadingOrErrorDisplay>}
          {/* PDF 표시 조건: URL이 있고, 로딩중이 아니고, 에러도 없을 때 */}
          {pdfFileUrl && !isLoadingPdf && !pdfError && (
            <>
              <PdfControls>
                <button type="button" onClick={goToPrevPage} disabled={currentPage <= 1}>이전</button>
                <span>{currentPage} / {numPages || '?'}</span>
                <button type="button" onClick={goToNextPage} disabled={!numPages || currentPage >= numPages}>다음</button>
              </PdfControls>
              <PdfViewerWrapper ref={pdfViewerWrapperRef}>
                <Document
                  file={pdfFileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={<LoadingOrErrorDisplay>문서 데이터 로딩 중...</LoadingOrErrorDisplay>}
                  error={<LoadingOrErrorDisplay style={{color: 'red'}}>PDF 파일을 표시할 수 없습니다. URL을 확인해주세요.</LoadingOrErrorDisplay>}
                  options={{ cMapUrl: `//unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/cmaps/`
                            , cMapPacked: true
                            , standardFontDataUrl: `//unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/standard_fonts/`}}
                >
                  <Page
                    pageNumber={currentPage}
                    width={pdfDisplayWidth > 50 ? pdfDisplayWidth : undefined}
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                    loading={<LoadingOrErrorDisplay>페이지 렌더링 중...</LoadingOrErrorDisplay>}
                    error={<LoadingOrErrorDisplay style={{color: 'red'}}>페이지를 표시할 수 없습니다.</LoadingOrErrorDisplay>}
                  />
                </Document>
              </PdfViewerWrapper>
            </>
          )}
          {/* 명시적으로 PDF를 표시할 수 없는 경우에 대한 메시지 */}
          {(!contract?.currentVersionId && !isLoadingPdf && !pdfError && isOpen) &&
            <LoadingOrErrorDisplay>PDF를 표시할 계약 버전 정보가 없습니다.</LoadingOrErrorDisplay>
          }
        </PdfSection>
      </ModalBodyStyled>
      <ModalFooter>
        <FooterButton type="button" onClick={onClose} style={{ backgroundColor: '#6c757d', borderColor: '#6c757d' }}>닫기</FooterButton>
        {pdfFileUrl && !pdfError && (
           <FooterButton as="a" href={pdfFileUrl} download={`${contract?.title || 'contract'}_v${contract?.currentVersionNumber || 'current'}.pdf`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '10px' }}>PDF 다운로드</FooterButton>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default ContractDetailModal;