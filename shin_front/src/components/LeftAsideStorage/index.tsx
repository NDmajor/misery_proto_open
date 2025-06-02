import { memo } from 'react'
import { LASBuyButton, LASContainer, LASHorizontalIndicator } from './styles'

const LeftAsideStorage = memo(function LeftAsideStorage() {
  return (
    <LASContainer>
      <div>
        <LASHorizontalIndicator>
          <div></div>
        </LASHorizontalIndicator>

        <a aria-label="저장 용량: 15 GB 중 7.17 GB 사용" data-no-tooltip>
          15 GB 중 7.17 GB 사용
        </a>

        <LASBuyButton aria-label="추가 저장용량 구매" data-no-tooltip>
          추가 저장용량 구매
        </LASBuyButton>
      </div>
    </LASContainer>
  )
})

export default LeftAsideStorage
