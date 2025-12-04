import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/authContext';
import SideNavigation from './SideNavigation';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const handleLogout = () => {
    // Add your logout logic here
  };
  return (
    <div className="app-layout">
       <header className="app-header">
        <button 
          onClick={() => navigate('/')}
          className="app-logo"
        >
          SyncGaze
        </button>
        <div className="header-actions">
          {user && (
            <>
              <span className="user-email">{user.email}</span>
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </header>
      <SideNavigation />
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;