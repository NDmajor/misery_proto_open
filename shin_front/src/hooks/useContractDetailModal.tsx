// src/hooks/useContractDetailModal.ts
import { useState, useCallback } from 'react';
import { IContract } from '../utils/api';

export interface UseContractDetailModalReturn {
  isModalOpen: boolean;
  selectedContract: IContract | null;
  openModal: (contract: IContract) => void;
  closeModal: () => void;
}

export const useContractDetailModal = (): UseContractDetailModalReturn => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<IContract | null>(null);

  const openModal = useCallback((contract: IContract) => {
    // 이미 모달이 열려있거나, 동일한 계약으로 다시 열려고 할 때 방지 (선택적)
    // if (isModalOpen && selectedContract?.id === contract.id) return;
    // 또는 단순히 이미 열려있으면 아무것도 안 함
    if (isModalOpen) {
        console.warn('[useContractDetailModal] Modal is already open. Preventing re-open.');
        return;
    }

    console.log('[useContractDetailModal] Opening modal for contract ID:', contract.id, 'Title:', contract.title);
    setSelectedContract(contract);
    setIsModalOpen(true);
  }, [isModalOpen]); // isModalOpen을 의존성에 추가하여 중복 방지 로직에 사용

  const closeModal = useCallback(() => {
    console.log('[useContractDetailModal] Closing modal.');
    setIsModalOpen(false);
    setSelectedContract(null);
  }, []);

  return {
    isModalOpen,
    selectedContract,
    openModal,
    closeModal,
  };
};