import LeftAsideButton from '../LeftAsideButtom'
import LeftAsideStorage from '../LeftAsideStorage'
import NewButton from '../NewButton'
import { LACContainer, LACDivider, LACItemsContainer } from './styles'

interface LeftAsideColumnProps {
  onContractUploadSuccess?: () => void;
}

function LeftAsideColumn({ onContractUploadSuccess }: LeftAsideColumnProps) {
  return (
    <LACContainer>
      <NewButton onContractUploadSuccess={onContractUploadSuccess} />

      <LACItemsContainer>
        <LeftAsideButton type="drive" isActive showMore />
        <LeftAsideButton type="computers" showMore />
        <LeftAsideButton type="shared" />
        <LeftAsideButton type="recent" />
        <LeftAsideButton type="starred" />
        <LeftAsideButton type="trash" />
        <LACDivider />
        <LeftAsideButton type="storage" />
      </LACItemsContainer>

      <LeftAsideStorage />
    </LACContainer>
  )
}

export default LeftAsideColumn