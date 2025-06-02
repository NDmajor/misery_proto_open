import { useNavigate } from 'react-router-dom';
import userImg from '../../assets/bighead.svg';
import { ReactComponent as GridAppsIcon } from '../../assets/icons/grid.svg';
import logoImg from '../../assets/logo.png';
import logo2Img from '../../assets/logo@2x.png';
import HeaderSearch from '../HeaderSearch'; // HeaderSearch 임포트
import logout from '../../assets/icons/logout.svg'; 
import {
  HAppsButton,
  HContainer,
  HLogoContainer,
  HUser,
  HUserButton,
} from './styles';
import { logoutApi } from '../../utils/api';

interface HeaderProps {
  onSearchTermChange: (term: string) => void;
}

function Header({ onSearchTermChange }: HeaderProps) { // props 받도록 수정
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutApi();
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      navigate('/login');
    } catch (e) {
      console.error(e);
      alert('로그아웃에 실패했습니다');
    }
  };

  return (
    <HContainer>
      <HLogoContainer>
        <a href="/app"> {/* App.tsx로 가는 것이 적절하다면 /app */}
          <img src={logoImg} alt="Misery Logo" srcSet={`${logoImg} 1x, ${logo2Img} 2x`} />
          <span>Misery</span>
        </a>
      </HLogoContainer>

      {/* HeaderSearch 컴포넌트에 onSearchTermChange prop 전달 */}
      <HeaderSearch onSearchTermChange={onSearchTermChange} />

      <HUser>
        <HAppsButton>
          <div>
            <button type="button" aria-label="Misery 앱">
              <GridAppsIcon />
            </button>
          </div>
        </HAppsButton>

        <HUserButton>
          <div>
            <button
              type="button"
              aria-label="Google Account: Development User (developmentUser@email.com)"
              data-tooltip-align="end"
            >
              <img src={userImg} alt="User Avatar" />
            </button>
          </div>
        </HUserButton>
        <HUserButton>
          <div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label='로그아웃'
            >
              <img src={logout} alt="Logout Icon" /> {/* logoutIcon으로 변경 */}
            </button>
          </div>
        </HUserButton>
      </HUser>
    </HContainer>
  );
}

export default Header;
