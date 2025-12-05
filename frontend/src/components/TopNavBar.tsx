import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import { useTranslation } from '../state/languageContext';
import './TopNavBar.css';

interface NavbarProps {
  showAuthButton?: boolean;
}

const Navbar = ({ showAuthButton = true }: NavbarProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();

  const handleNavClick = async () => {
    if (user) {
      await signOut();
      navigate('/');
      return;
    }
    navigate('/auth');
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
        SyncGaze
      </div>
      {showAuthButton && (
        <button className="nav-button" onClick={handleNavClick}>
          {user ? t('landing.nav.signOut') : t('landing.nav.signIn')}
        </button>
      )}
    </nav>
  );
};

export default Navbar;