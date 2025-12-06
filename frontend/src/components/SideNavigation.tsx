import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import { Home, Crosshair, Wrench, BarChart3, Trophy, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import './SideNavigation.css';
import { useState } from 'react';

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
  const [collapsed, setCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: Home, label: 'Dashboard', protected: true },
    { path: '/calibration', icon: Crosshair, label: 'Train', protected: true },
    { path: '/sessions', icon: BarChart3, label: 'Your sessions', protected: true },
    { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', protected: true },
    { path: '/settings', icon: Settings, label: 'Settings', protected: true },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.protected || (item.protected && user)
  );

  return (
    <nav className={`side-navigation ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-nav-header">
        <button
          type="button"
          className="collapse-toggle"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setCollapsed(prev => !prev)}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
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
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </button>
          );
        })}
        
        {/* Language Toggle at bottom of nav items */}
        <div className="nav-items-spacer"></div>
        {!collapsed && <LanguageToggle variant="sidebar" />}
      </div>

      <div className="side-nav-footer">
        {user && (
          <div className="user-info">
            <div className="user-avatar">{user.email?.[0]?.toUpperCase()}</div>
            {!collapsed && (
              <div className="user-details">
                <div className="user-email">{user.email}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default SideNavigation;
