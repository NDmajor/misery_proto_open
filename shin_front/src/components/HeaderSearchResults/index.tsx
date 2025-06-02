import moment from 'moment';
import { useEffect, useState } from 'react';
// 아래 이미지 import 경로는 실제 프로젝트 구조에 맞게 확인해주세요.
import documentsImg from '../../assets/icons/documents.png'; // 사용 예시로 남겨두지만, getIcon으로 대체될 수 있음
import imageImg from '../../assets/icons/image.png';
import pdfImg from '../../assets/icons/pdf.png';
import presentationImg from '../../assets/icons/presentation.png';
import spreadsheetImg from '../../assets/icons/spreadsheet.png';
import videoImg from '../../assets/icons/video.png';
// files.json은 초기 데이터 시뮬레이션 및 검색 필터링의 대체(fallback) 데이터로 사용됩니다.
import initialMockFiles from '../../data/files.json';
import getIcon from '../../utils/getIcon'; // 이 함수는 파일 타입에 맞는 아이콘 경로를 반환해야 합니다.
import ListTile from '../ListTile';
import { HSRContainer, HSRContent, HSRMoreResults } from './styles';

interface IProps {
  value: string; // 검색 입력 값
}

interface IResults {
  id: string;
  name: string;
  type: string;
  createdBy: string;
  updatedAt: number;
}

// 중요: 실제 API 호출 함수로 교체해야 합니다.
// 이 함수는 현재 로그인된 사용자의 h2 cloud 데이터를 가져와야 합니다.
// 인증 처리를 포함해야 할 수 있습니다.
async function fetchAllH2CloudFiles(): Promise<IResults[]> {
  console.log("h2 cloud에서 현재 사용자의 모든 파일을 가져오는 중입니다 (시뮬레이션)...");
  // API 호출 시뮬레이션 (네트워크 지연)
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 실제 애플리케이션에서는 다음과 같이 API를 호출합니다:
  // try {
  //   const response = await fetch('/api/me/h2-cloud/files', {
  //     headers: {
  //       // 필요한 경우 인증 토큰 등을 여기에 추가
  //       // 'Authorization': `Bearer ${userToken}`
  //     }
  //   });
  //   if (!response.ok) {
  //     throw new Error(`HTTP error! status: ${response.status}`);
  //   }
  //   const data = await response.json();
  //   return data as IResults[];
  // } catch (error) {
  //   console.error("h2 cloud 파일 가져오기 실패:", error);
  //   throw error; // 오류를 다시 던져서 호출한 쪽에서 처리하도록 함
  // }

  // 데모를 위해 로컬 JSON 파일(initialMockFiles) 내용을 반환합니다.
  // 클라우드에 파일이 없는 시나리오를 테스트하려면 빈 배열을 반환하세요: return [];
  return initialMockFiles.map(file => ({ ...file })); // 원본 수정을 방지하기 위해 복사본 반환
}

function HeaderSearchResults({ value }: IProps) {
  // 클라우드에서 가져온 모든 파일 원본을 저장하는 상태
  const [allUserCloudFiles, setAllUserCloudFiles] = useState<IResults[] | null>(null);
  // 화면에 표시될 결과 (초기에는 모든 파일, 검색 시 필터링된 파일)
  const [displayedResults, setDisplayedResults] = useState<IResults[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // 초기 데이터 로딩을 위해 true로 시작
  const [error, setError] = useState<string | null>(null);

  // 1. 컴포넌트 마운트 시 초기 데이터 (모든 클라우드 파일)를 가져오는 useEffect
  useEffect(() => {
    const loadInitialFiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filesFromCloud = await fetchAllH2CloudFiles();
        setAllUserCloudFiles(filesFromCloud);
        // 검색어가 없는 초기 상태이므로, 가져온 모든 파일을 표시
        setDisplayedResults(filesFromCloud);
      } catch (err: any) {
        console.error("초기 파일 로딩 중 오류 발생:", err);
        setError("클라우드 파일을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.");
        setAllUserCloudFiles([]); // 오류 발생 시 빈 배열로 설정
        setDisplayedResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialFiles();
  }, []); // 의존성 배열이 비어있으므로 컴포넌트 마운트 시 한 번만 실행

  // 2. 검색어(value) 또는 로드된 전체 파일(allUserCloudFiles) 변경 시 필터링을 수행하는 useEffect
  useEffect(() => {
    // 아직 allUserCloudFiles가 로드되지 않았다면 (초기 로딩 중이거나 실패 후) 아무것도 하지 않음
    if (allUserCloudFiles === null) {
      return;
    }

    setIsLoading(true); // 필터링 시작 시 로딩 상태 활성화 (UI 피드백용)

    if (!value) {
      // 검색어가 없으면, 로드된 모든 클라우드 파일을 표시
      setDisplayedResults(allUserCloudFiles);
    } else {
      // 검색어가 있으면, allUserCloudFiles를 필터링
      const filtered = allUserCloudFiles.filter(file =>
        file.name.toLowerCase().includes(value.toLowerCase())
      );
      setDisplayedResults(filtered);
    }

    // 필터링이 매우 빠르다면 setTimeout은 필요 없을 수 있습니다.
    // UI가 로딩 상태를 반영할 시간을 주기 위해 짧은 지연을 둘 수 있습니다.
    const timer = setTimeout(() => {
        setIsLoading(false);
    }, 100); // 필터링 작업 후 로딩 상태 비활성화

    return () => clearTimeout(timer); // 클린업 함수

  }, [value, allUserCloudFiles]); // `value` 또는 `allUserCloudFiles`가 변경될 때마다 실행

  // --- 렌더링 로직 ---

  if (isLoading && displayedResults === null) { // 초기 로딩 중이거나 필터링 시작 시
    return (
      <HSRContainer>
        <HSRContent>
          <p>불러오는 중...</p>
        </HSRContent>
      </HSRContainer>
    );
  }

  if (error) {
    return (
      <HSRContainer>
        <HSRContent>
          <p style={{ color: 'red' }}>{error}</p>
        </HSRContent>
      </HSRContainer>
    );
  }

  // 로딩이 끝났고, 에러도 없고, displayedResults가 배열일 때 (빈 배열 포함)
  if (displayedResults) {
    if (displayedResults.length === 0) {
      if (!value) { // 검색어가 없는데 결과가 없음 = 클라우드가 비어있음
        return (
          <HSRContainer>
            <HSRContent>
              <p>h2 cloud에 파일이 없습니다.</p>
              {/* 필요에 따라 "더 많은 검색 도구" 등을 여기에 표시할 수 있습니다. */}
              {/* <HSRMoreResults title="옵션 살펴보기" /> */}
            </HSRContent>
          </HSRContainer>
        );
      } else { // 검색어가 있는데 결과가 없음 = 검색 결과 없음
        return (
          <HSRContainer>
            <HSRContent>
              <p>
                {value}에 대한 검색 결과가 없습니다.
              </p>
              {/* "이전 항목 검색" 기능이 여전히 관련이 있는지, 어떻게 작동할지 고려해야 합니다. */}
              <HSRMoreResults title="더 많은 검색 도구" />
            </HSRContent>
          </HSRContainer>
        );
      }
    }

    // 표시할 결과가 있는 경우
    return (
      <HSRContainer>
        <HSRContent>
          {displayedResults.map(file => (
            <ListTile
              key={file.id}
              // getIcon 함수는 파일 타입에 맞는 아이콘 이미지 경로를 반환해야 합니다.
              // 예: getIcon('pdf') -> pdfImg
              icon={<img src={getIcon(file.type)} alt={`${file.type} 아이콘`} />}
              title={file.name}
              subtitle={file.createdBy}
              trailing={moment(file.updatedAt).format('DD/MM/YY')}
            />
          ))}
          {/* "더 많은 검색 도구"는 결과가 많거나 검색이 활성화된 경우 조건부로 표시할 수 있습니다. */}
          {/* <HSRMoreResults title="더 많은 검색 도구" /> */}
        </HSRContent>
      </HSRContainer>
    );
  }

  // 위 조건에 해당하지 않는 경우 (예: displayedResults가 아직 null이고 로딩도 아닌 극히 드문 경우)
  return null;
}

export default HeaderSearchResults;