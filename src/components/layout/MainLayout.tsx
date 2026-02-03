import React from 'react';
import Header from './Header';
import WorkflowStepper from './WorkflowStepper';
import { useProject } from '@/contexts/ProjectContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { currentProject, viewMode } = useProject();

  const showStepper = viewMode === 'workflow' && currentProject;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {showStepper && <WorkflowStepper />}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
