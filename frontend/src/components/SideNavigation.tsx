import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import { Home, Target, Wrench, BarChart3, Trophy, Settings } from 'lucide-react';
import './SideNavigation.css';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  protected?: boolean;
}

const SideNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: Home, label: 'Dashboard', protected: true },
    { path: '/tracker-flow', icon: Target, label: 'Tracker Flow', protected: true },
    { path: '/calibration', icon: Wrench, label: 'Calibration', protected: true },
    { path: '/results', icon: BarChart3, label: 'Results', protected: true },
    { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', protected: true },
    { path: '/settings', icon: Settings, label: 'Settings', protected: true },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.protected || (item.protected && user)
  );

  return (
    <nav className="side-navigation">


      <div className="side-nav-items">
        {filteredNavItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`side-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">
                <IconComponent size={20} />
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
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