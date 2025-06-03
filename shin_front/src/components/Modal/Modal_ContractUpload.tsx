import React, { useState, useRef, useCallback, useEffect } from 'react';
import Modal from 'react-modal';
import logoImg from '../../assets/logo.png';

// Modal 스타일 관련 임포트
import CustomModal from './Modal';
import {
  ModalHeader, ModalLogo, CloseButton, ModalBody, ModalTitle,
  ModalDesc, UploadArea, UploadIcon, UploadTitle, UploadDesc, ModalFooter,
  FooterButton, InputGroup, StyledLabel, StyledInput,
  // 새로 추가된 스타일 임포트
  SearchContainer, SearchInput, SearchButton,
  SearchResultsContainer, SearchResultItem, NoResultsMessage,
  SelectedCounterpartiesContainer, SelectedCounterpartyList, SelectedCounterpartyItem,
  RemoveCounterpartyButton
} from './styles';

// API 함수 및 타입 임포트
import {
  uploadContractApi, ContractUploadData,
  searchUsersApi, UserSearchResponseItem, UserSearchPage // 추가된 API 및 타입
} from '../../utils/api';

interface ModalUploadContractProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModalUploadContract: React.FC<ModalUploadContractProps> = ({
  isOpen,
  onClose,
}) => {
  const [contractTitle, setContractTitle] = useState('');
  // const [contractDescription, setContractDescription] = useState(''); // 설명 필드 삭제
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // 피계약자 검색 및 선택 관련 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResponseItem[]>([]);
  const [selectedCounterparties, setSelectedCounterparties] = useState<UserSearchResponseItem[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchPageInfo, setSearchPageInfo] = useState<UserSearchPage | null>(null);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null); // 검색창 포커스용

  useEffect(() => {
    if (isOpen) {
      setContractTitle('');
      setSelectedFile(null);
      setSelectedFileName('');
      setIsUploading(false);
      setSearchKeyword('');
      setSearchResults([]);
      setSelectedCounterparties([]);
      setIsLoadingSearch(false);
      setSearchPageInfo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

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

  const triggerFileInput = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleCloseModal = useCallback(() => {
    if (isUploading) return;
    onClose();
  }, [onClose, isUploading]);

  // --- 사용자 검색 로직 ---
  const handleUserSearch = async (page: number = 0) => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      setSearchPageInfo(null);
      return;
    }
    setIsLoadingSearch(true);
    try {
      const pageData = await searchUsersApi(searchKeyword.trim(), page);
      setSearchResults(pageData.content);
      setSearchPageInfo(pageData);
    } catch (error) {
      console.error('사용자 검색 실패:', error);
      setSearchResults([]);
      setSearchPageInfo(null);
      alert(error instanceof Error ? error.message : '사용자 검색 중 오류 발생');
    } finally {
      setIsLoadingSearch(false);
    }
  };

  // 검색 버튼 클릭 또는 Enter 키 입력 시 검색 실행
  const onSearchSubmit = (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.preventDefault();
    handleUserSearch(0); // 첫 페이지부터 검색
    if(searchInputRef.current) searchInputRef.current.blur(); // 검색 후 포커스 해제 (결과 보기 용이)
  };


  // --- 피계약자 선택 로직 ---
  const handleAddCounterparty = (user: UserSearchResponseItem) => {
    if (!selectedCounterparties.find(p => p.identifier === user.identifier)) {
      setSelectedCounterparties(prev => [...prev, user]);
    }
    setSearchKeyword(''); // 검색어 초기화
    setSearchResults([]); // 검색 결과 목록 초기화
    setSearchPageInfo(null);
  };

  const handleRemoveCounterparty = (userUuid: string) => {
    setSelectedCounterparties(prev => prev.filter(p => p.identifier !== userUuid));
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
    if (selectedCounterparties.length === 0) {
      // 피계약자 없이도 업로드 가능하게 하려면 이 조건을 제거하거나 수정
      // alert('피계약자를 1명 이상 선택해주세요.');
      // return;
      console.warn('피계약자 없이 계약을 업로드합니다.');
    }

    const participantIds = selectedCounterparties.map(p => p.identifier);

    const contractData: ContractUploadData = {
      title: contractTitle,
      // description 필드 제거
      participantIds: participantIds,
    };

    setIsUploading(true);
    try {
      await uploadContractApi(contractData, selectedFile);
      alert(`${selectedFileName} 파일 업로드 성공!`);
      handleCloseModal();
    } catch (error) {
      console.error('업로드 실패:', error);
      alert(`업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleCloseModal}
      style={CustomModal}
      contentLabel="계약서 업로드"
      ariaHideApp={false}
    >
      <ModalHeader>
        <ModalLogo>
          <img src={logoImg} alt="Misery Logo" style={{ height: '32px' }} />
        </ModalLogo>
        <CloseButton type="button" onClick={handleCloseModal} disabled={isUploading}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </CloseButton>
      </ModalHeader>

      <ModalBody>
        <ModalTitle>계약서 업로드</ModalTitle>
        <InputGroup>
          <StyledLabel htmlFor="contractTitleModal">계약 제목</StyledLabel>
          <StyledInput
            id="contractTitleModal"
            type="text"
            value={contractTitle}
            onChange={(e) => setContractTitle(e.target.value)}
            placeholder="계약 제목을 입력하세요"
            disabled={isUploading}
          />
        </InputGroup>

        {/* 피계약자 검색 및 선택 UI */}
        <InputGroup>
          <StyledLabel htmlFor="counterpartySearchModal">피계약자 검색</StyledLabel>
          <form onSubmit={onSearchSubmit}> {/* form으로 감싸 Enter키로 검색 가능하게 */}
            <SearchContainer>
              <SearchInput
                ref={searchInputRef}
                id="counterpartySearchModal"
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="이름, 이메일, UUID로 검색"
                disabled={isUploading}
              />
              <SearchButton type="submit" onClick={onSearchSubmit} disabled={isUploading || isLoadingSearch}>
                {isLoadingSearch ? '검색중...' : '검색'}
              </SearchButton>
            </SearchContainer>
          </form>

          {/* 검색 결과 표시 */}
          { (isLoadingSearch || searchResults.length > 0 || (searchKeyword && !isLoadingSearch && searchResults.length === 0)) && (
            <SearchResultsContainer>
              {isLoadingSearch && <NoResultsMessage>검색 중...</NoResultsMessage>}
              {!isLoadingSearch && searchResults.length === 0 && searchKeyword && (
                <NoResultsMessage>검색 결과가 없습니다.</NoResultsMessage>
              )}
              {!isLoadingSearch && searchResults.map(user => (
                <SearchResultItem key={user.identifier} onClick={() => handleAddCounterparty(user)}>
                  {user.name} ({user.identifier})
                  <small>{user.email}</small>
                </SearchResultItem>
              ))}
            </SearchResultsContainer>
          )}
          {/* 페이지네이션 컨트롤 (간단한 예시, 필요시 확장) */}
          {searchPageInfo && searchPageInfo.totalPages > 1 && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <button 
                onClick={() => handleUserSearch(searchPageInfo.number - 1)} 
                disabled={searchPageInfo.number === 0 || isLoadingSearch}
                style={{marginRight: '0.5rem'}}
              >
                이전
              </button>
              <span>{searchPageInfo.number + 1} / {searchPageInfo.totalPages}</span>
              <button 
                onClick={() => handleUserSearch(searchPageInfo.number + 1)} 
                disabled={searchPageInfo.number + 1 >= searchPageInfo.totalPages || isLoadingSearch}
                style={{marginLeft: '0.5rem'}}
              >
                다음
              </button>
            </div>
          )}


          {/* 선택된 피계약자 목록 표시 */}
          {selectedCounterparties.length > 0 && (
            <SelectedCounterpartiesContainer>
              <StyledLabel>선택된 피계약자</StyledLabel>
              <SelectedCounterpartyList>
                {selectedCounterparties.map(user => (
                  <SelectedCounterpartyItem key={user.identifier}>
                    <span>{user.name} ({user.identifier.substring(0,8)}...)</span>
                    <RemoveCounterpartyButton type="button" onClick={() => handleRemoveCounterparty(user.identifier)} disabled={isUploading}>
                      &times;
                    </RemoveCounterpartyButton>
                  </SelectedCounterpartyItem>
                ))}
              </SelectedCounterpartyList>
            </SelectedCounterpartiesContainer>
          )}
        </InputGroup>

        <ModalDesc style={{ marginTop: selectedCounterparties.length > 0 ? '1rem' : '0' }}> {/* 파일 업로드 설명 위치 조정 */}
          {selectedFileName ? `선택된 파일: ${selectedFileName}` : '아래 영역을 클릭하거나 파일을 드래그하여 업로드하세요. (PDF)'}
        </ModalDesc>

        <input
          type="file"
          accept=".pdf"
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
              <UploadIcon>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
              </UploadIcon>
              <UploadTitle>업로드할 파일을 드래그하거나 클릭하세요</UploadTitle>
              <UploadDesc>PDF 파일 형식만 지원됩니다.</UploadDesc>
            </>
          )}
        </UploadArea>
      </ModalBody>

      <ModalFooter>
        <FooterButton type="button" onClick={handleCloseModal} disabled={isUploading}>취소</FooterButton>
        <FooterButton
          type="button"
          onClick={handleActualUpload}
          disabled={isUploading || !selectedFile || !contractTitle.trim()}
        >
          {isUploading ? '업로드 중...' : '파일 업로드'}
        </FooterButton>
      </ModalFooter>
    </Modal>
  );
};

export default ModalUploadContract;