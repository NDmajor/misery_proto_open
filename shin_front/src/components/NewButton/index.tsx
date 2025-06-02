import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { ReactComponent as PlusIcon } from '../../assets/icons/plus.svg'; //
import {
  NBContainer,
  DropdownContainer,
  DropdownItem
} from './styles'; //

// 업로드 모달 컴포넌트 임포트
import ModalUploadContract from '../Modal/Modal_ContractUpload'; //

const NewButton = memo(function NewButton() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false); // 모달 표시 상태
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleOpenUploadModal = () => {
    setIsDropdownOpen(false);
    setIsUploadModalVisible(true); // 업로드 모달을 표시
  };
  
  const handleFolderUpload = () => {
    alert('폴더 업로드 기능 구현 예정');
    setIsDropdownOpen(false);
  };

  // 업로드 성공 후 목록 새로고침 등의 로직이 필요하면 여기에 추가
  // const handleUploadSuccess = () => {
  //   console.log('업로드 성공! 관련 데이터를 새로고침합니다.');
  //   // 예: fetchMyContracts();
  // };

  return (
    <NBContainer>
      <button type="button" onClick={toggleDropdown}>
        <PlusIcon />
        New
      </button>
      {isDropdownOpen && (
        <DropdownContainer ref={dropdownRef}>
          <DropdownItem onClick={handleCreateFolder}>폴더 만들기</DropdownItem>
          <DropdownItem onClick={handleOpenUploadModal}>파일 업로드</DropdownItem>
          <DropdownItem onClick={handleFolderUpload}>폴더 업로드</DropdownItem>
        </DropdownContainer>
      )}

      {/* 계약서 업로드 모달 */}
      <ModalUploadContract
        isOpen={isUploadModalVisible}
        onClose={() => setIsUploadModalVisible(false)}
        // onUploadSuccess={handleUploadSuccess} // 필요시 추가
      />
    </NBContainer>
  );
});

export default NewButton;