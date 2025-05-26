import { memo, useState, useRef, useEffect, useCallback } from 'react';
import Modal from 'react-modal';
import { ReactComponent as PlusIcon } from '../../assets/icons/plus.svg';
import logoImg from '../../assets/logo.png';
import {
  NBContainer,
  DropdownContainer,
  DropdownItem
} from './styles';
import CustomModal from '../Modal/Modal';
import {
  ModalHeader, ModalLogo, /* LogoCircle, */ CloseButton, ModalBody, ModalTitle,
  ModalDesc, UploadArea, UploadIcon, UploadTitle, UploadDesc, ModalFooter,
  FooterButton,
  // 계약 업로드 모달을 위해 추가적인 스타일 컴포넌트 import (필요시 Modal/styles.ts에 정의)
  InputGroup, StyledLabel, StyledInput, //StyledTextarea // StyledTextarea 추가 가정
} from '../Modal/styles'; // 경로 및 컴포넌트명 확인

// api.ts에서 uploadContractApi 함수 import
import { uploadContractApi, ContractUploadData } from '../../utils/api'; // 경로 확인

const NewButton = memo(function NewButton() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // --- 계약 업로드에 필요한 추가 상태 ---
  const [contractTitle, setContractTitle] = useState('');
  const [contractDescription, setContractDescription] = useState('');
  const [participantIdsInput, setParticipantIdsInput] = useState(''); // 쉼표로 구분된 UUID 문자열 입력
  const [isUploading, setIsUploading] = useState(false); // 업로드 진행 상태

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const handleOutsideClick = useCallback(
    (event: MouseEvent) => {
      const buttonElement = dropdownRef.current?.parentElement?.querySelector('button');
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        event.target !== buttonElement &&
        !buttonElement?.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen, handleOutsideClick]);


  const handleCreateFolder = () => {
    alert('폴더 만들기 기능 구현 예정');
    setIsDropdownOpen(false);
  };
  const handleFolderUpload = () => {
    alert('폴더 업로드 기능 구현 예정');
    setIsDropdownOpen(false);
  };

  const handleFileUpload = () => {
    setIsDropdownOpen(false);
    setSelectedFile(null);
    setSelectedFileName('');
    setContractTitle('');
    setContractDescription('');
    setParticipantIdsInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsUploadModalOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedFileName(file.name);
    } else {
      setSelectedFile(null);
      setSelectedFileName('');
    }
  };

  const closeUploadModal = () => {
    if (isUploading) return; // 업로드 중에는 닫기 방지
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setSelectedFileName('');
    setContractTitle('');
    setContractDescription('');
    setParticipantIdsInput('');
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleActualUpload = async () => {
    if (!selectedFile) {
      alert('업로드할 파일을 선택해주세요.');
      return;
    }
    if (!contractTitle.trim()) {
      alert('계약 제목을 입력해주세요.');
      return;
    }
    // 참여자 ID가 입력되었다면 파싱, 아니면 빈 배열
    const participantIds = participantIdsInput.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    // 백엔드 DTO 형식에 맞춤
    const contractData: ContractUploadData = {
      title: contractTitle,
      description: contractDescription,
      participantIds: participantIds, // 예: ["uuid1", "uuid2"]
    };

    setIsUploading(true);
    try {
      console.log('업로드 시작 데이터:', contractData);
      console.log('업로드 시작 파일:', selectedFile);

      const response = await uploadContractApi(contractData, selectedFile);
      console.log('업로드 성공:', response);
      alert(`${selectedFile.name} 파일 업로드 성공!`);
      closeUploadModal();
      // TODO: 업로드 성공 후 계약 목록 새로고침 등의 작업 추가
    } catch (error) {
      console.error('업로드 실패:', error);
      alert(`업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <NBContainer>
      <button type="button" onClick={toggleDropdown}>
        <PlusIcon />
        New
      </button>
      {isDropdownOpen && (
        <DropdownContainer ref={dropdownRef}>
          <DropdownItem onClick={handleCreateFolder}>폴더 만들기</DropdownItem>
          <DropdownItem onClick={handleFileUpload}>파일 업로드</DropdownItem>
          <DropdownItem onClick={handleFolderUpload}>폴더 업로드</DropdownItem>
        </DropdownContainer>
      )}

      <Modal
        isOpen={isUploadModalOpen}
        onRequestClose={closeUploadModal}
        style={CustomModal} // styles/Modal.ts 에서 가져온 스타일 객체
        contentLabel="Upload Contract Modal"
      >
        <ModalHeader>
          <ModalLogo>
            <img src={logoImg} alt="Misery Logo" style={{ height: '32px' }} />
          </ModalLogo>
          <CloseButton type="button" onClick={closeUploadModal} disabled={isUploading}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"> {/* X 아이콘 SVG */}
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <ModalTitle>계약서 업로드</ModalTitle>
          {/* 계약 정보 입력 필드 */}
          <InputGroup>
            <StyledLabel htmlFor="contractTitle">계약 제목</StyledLabel>
            <StyledInput
              id="contractTitle"
              type="text"
              value={contractTitle}
              onChange={(e) => setContractTitle(e.target.value)}
              placeholder="계약 제목을 입력하세요"
              disabled={isUploading}
            />
          </InputGroup>
          <InputGroup>
            <StyledLabel htmlFor="contractDescription">설명 (선택)</StyledLabel>
            {/* StyledTextarea가 없으면 StyledInput을 재활용하거나 새로 정의 */}
            <StyledInput // 또는 <StyledTextarea
              as="textarea" // styled-components의 as 프롭 활용 가능
              id="contractDescription"
              value={contractDescription}
              onChange={(e) => setContractDescription(e.target.value)}
              placeholder="계약에 대한 설명을 입력하세요"
              rows={3}
              disabled={isUploading}
              style={{ minHeight: '60px', resize: 'vertical' }}
            />
          </InputGroup>
          <InputGroup>
            <StyledLabel htmlFor="participantIds">참여자 UUID (쉼표로 구분)</StyledLabel>
            <StyledInput
              id="participantIds"
              type="text"
              value={participantIdsInput}
              onChange={(e) => setParticipantIdsInput(e.target.value)}
              placeholder="예: uuid1,uuid2,uuid3"
              disabled={isUploading}
            />
          </InputGroup>

          <ModalDesc>
            {selectedFileName ? `선택된 파일: ${selectedFileName}` : '아래 영역을 클릭하거나 파일을 드래그하여 업로드하세요. (PDF)'}
          </ModalDesc>

          <input
            type="file"
            accept=".pdf" // PDF 파일만 허용
            onChange={handleFileChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
            disabled={isUploading}
          />

          <UploadArea type="button" onClick={triggerFileInput} disabled={isUploading}>
            {selectedFileName ? (
              <>
                <UploadTitle>파일 선택됨</UploadTitle>
                <UploadDesc>다른 파일을 선택하려면 <strong>여기를 클릭</strong>하세요.</UploadDesc>
              </>
            ) : (
              <>
                <UploadIcon>{/* 업로드 아이콘 SVG (예시) */}
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                </UploadIcon>
                <UploadTitle>업로드할 파일을 드래그하거나 클릭하세요</UploadTitle>
                <UploadDesc>PDF 파일 형식만 지원됩니다.</UploadDesc>
              </>
            )}
          </UploadArea>
        </ModalBody>

        <ModalFooter>
          <FooterButton type="button" onClick={closeUploadModal} disabled={isUploading}>취소</FooterButton>
          <FooterButton type="button" onClick={handleActualUpload} disabled={isUploading || !selectedFile}>
            {isUploading ? '업로드 중...' : '파일 업로드'}
          </FooterButton>
        </ModalFooter>
      </Modal>
    </NBContainer>
  );
});

export default NewButton;