import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import { Home, Crosshair, Wrench,BookOpen, BarChart3, Trophy, Settings, PanelLeftClose, PanelLeftOpen, FileText } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import './SideNavigation.css';
import { useState } from 'react';
import { useTranslation } from '../state/languageContext';

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
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: Home, label: t('nav.dashboard', 'Dashboard'), protected: true },
    { path: '/calibration', icon: Crosshair, label: t('nav.calibration', 'Train'), protected: true },
    { path: '/sessions', icon: BarChart3, label: t('nav.sessions', 'Your sessions'), protected: true },
    { path: '/report', icon: FileText, label: t('nav.report', 'Report'), protected: true },
    { path: '/leaderboard', icon: Trophy, label: t('nav.leaderboard', 'Leaderboard'), protected: true },
    { path: '/how-to', icon: BookOpen, label: t('nav.howto', 'How-to guide'), protected: true },
    { path: '/settings', icon: Settings, label: t('nav.settings', 'Settings'), protected: true },
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
          aria-label={collapsed ? t('nav.expand', 'Expand navigation') : t('nav.collapse', 'Collapse navigation')}
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
        {!collapsed && (
          <div className="nav-bottom-actions">
            <LanguageToggle variant="sidebar" />
            <button
              type="button"
              className="sidebar-utility-button"
              onClick={() => navigate('/about')}
            >
              {t('landing.cta.aboutUs', 'About Us')}
            </button>
          </div>
        )}
      </div>

      <div className="side-nav-footer">
        {user && (
          <button
            type="button"
            className="user-info"
            onClick={() => navigate('/account')}
            aria-label={t('nav.accountSummary', 'View account info and session summary')}
          >
            <div className="user-avatar">{user.email?.[0]?.toUpperCase()}</div>
            {!collapsed && (
              <div className="user-details">
                <div className="user-email">{user.email}</div>
                <div className="user-meta">{t('nav.accountMeta', 'See account summary')}</div>
              </div>
            )}
          </button>
        )}
      </div>
    </nav>
  );
};

export default SideNavigation;
