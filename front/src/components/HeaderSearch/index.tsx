import React, { useRef, useState, useEffect } from 'react';
import { ReactComponent as AskIcon } from '../../assets/icons/ask.svg';
import { ReactComponent as CloseIcon } from '../../assets/icons/close.svg';
import { ReactComponent as GearIcon } from '../../assets/icons/gear.svg';
import { ReactComponent as SearchIcon } from '../../assets/icons/search.svg';
import { ReactComponent as SettingsIcon } from '../../assets/icons/settings.svg';
import { DropButton, HSContainer, HSForm, HSFormContainer } from './styles';

interface HeaderSearchProps {
  onSearchTermChange: (term: string) => void;
}

function HeaderSearch({ onSearchTermChange }: HeaderSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  // 'isResultsVisible' 또는 'openResults' 상태를 정의합니다. 여기서는 'isFormActive'로 명명하여 의미를 명확히 할 수 있습니다.
  // HSForm의 openResults prop이 검색 결과창 직접 표시가 아닌, 폼 자체의 활성 상태 스타일링에 사용될 경우를 가정합니다.
  const [isFormActive, setIsFormActive] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchTermChange(inputValue);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, onSearchTermChange]);

  const clearSearch = () => {
    inputRef.current?.focus();
    setInputValue('');
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleFocus = () => setIsFormActive(true); // input에 포커스 시 상태 true
  const handleBlur = () => {
    // 클릭으로 인한 blur 방지를 위해 약간의 딜레이 후 상태 false (원래 로직 참고)
    // 만약 HSForm 내부의 다른 버튼 클릭 시에도 닫히지 않게 하려면 더 복잡한 로직이 필요할 수 있습니다.
    setTimeout(() => {
      // document.activeElement는 현재 focus된 요소를 확인하기 위함이나,
      // HSForm의 openResults가 단순히 focus 여부로 스타일링한다면 더 간단하게 처리 가능
      setIsFormActive(false);
    }, 150); // 딜레이 시간은 적절히 조절
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchTermChange(inputValue);
    // 검색 제출 후에도 포커스를 유지하거나, 특정 로직에 따라 isFormActive를 조절할 수 있습니다.
    // 예: inputRef.current?.focus();
  };

  // HSForm에 전달할 openResults 값을 결정합니다.
  // 예를 들어, 입력값이 있거나 폼이 활성화(포커스) 상태일 때 true로 설정할 수 있습니다.
  // 또는 단순히 isFormActive 상태를 사용할 수 있습니다.
  // const derivedOpenResults = inputValue.length > 0 || isFormActive;

  return (
    <HSContainer>
      <HSFormContainer>
        {/* 주석: "// openResults prop 제거"는 현재 코드와 맞지 않습니다.
          HSForm은 openResults prop을 여전히 받고 있으며, 이 값이 HSForm의 스타일에 영향을 줄 수 있습니다.
          여기서는 isFormActive 상태를 openResults 값으로 사용합니다.
        */}
        <HSForm onSubmit={handleSubmit} openResults={isFormActive}> {/* isFormActive (또는 derivedOpenResults) 사용 */}
          <button type="submit" aria-label="Search">
            <SearchIcon />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            placeholder="내 계약 검색"
            onChange={handleChange}
            onFocus={handleFocus}   
            onBlur={handleBlur}   
          />

          <button
            type="button"
            aria-label="검색 초기화"
            disabled={!inputValue}
            onClick={clearSearch}
          >
            <CloseIcon />
          </button>

          <button type="button" aria-label="검색 설정 (미구현)">
            <SettingsIcon />
          </button>
        </HSForm>
      </HSFormContainer>

      <DropButton type="button" aria-label="지원 (미구현)">
        <AskIcon />
      </DropButton>

      <DropButton type="button" darkHover aria-label="설정 (미구현)">
        <GearIcon />
      </DropButton>
    </HSContainer>
  );
}

export default HeaderSearch;