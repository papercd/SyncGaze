import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import './SideNavigation.css';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  protected?: boolean;
}

const SideNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: '🏠', label: 'Dashboard', protected: true },
    { path: '/tracker-flow', icon: '🎯', label: 'Tracker Flow', protected: true },
    { path: '/calibration', icon: '⚙️', label: 'Calibration', protected: true },
    { path: '/results', icon: '📊', label: 'Results', protected: true },
    { path: '/leaderboard', icon: '🏆', label: 'Leaderboard', protected: true },
    { path: '/settings', icon: '⚡', label: 'Settings', protected: true },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.protected || (item.protected && user)
  );

  return (
    <nav className="side-navigation">
      <div className="side-nav-header">
        <button 
          onClick={() => navigate('/')}
          className="side-nav-logo"
        >
          SyncGaze
        </button>
      </div>

      <div className="side-nav-items">
        {filteredNavItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`side-nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="side-nav-footer">
        {user && (
          <div className="user-info">
            <div className="user-avatar">{user.email?.[0]?.toUpperCase()}</div>
            <div className="user-details">
              <div className="user-email">{user.email}</div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default SideNavigation;