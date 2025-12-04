import { ReactNode } from 'react';
import SideNavigation from './SideNavigation';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="app-layout">
      <SideNavigation />
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;