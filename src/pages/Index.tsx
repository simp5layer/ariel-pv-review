import React from 'react';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import MainLayout from '@/components/layout/MainLayout';
import LandingPage from '@/components/workflow/LandingPage';
import ProjectHistory from '@/components/workflow/ProjectHistory';
import ProjectSetup from '@/components/workflow/ProjectSetup';
import AnalyzeExtract from '@/components/workflow/AnalyzeExtract';
import StandardsUpload from '@/components/workflow/StandardsUpload';
import DesignReview from '@/components/workflow/DesignReview';

const WorkflowContent: React.FC = () => {
  const { currentStep, currentProject } = useProject();

  // If no project, always show setup
  if (!currentProject) {
    return <ProjectSetup />;
  }

  // Render step based on current step
  switch (currentStep) {
    case 0:
      return <ProjectSetup />;
    case 1:
      return <AnalyzeExtract />;
    case 2:
      return <StandardsUpload />;
    case 3:
      return <DesignReview />;
    default:
      return <ProjectSetup />;
  }
};

const AppContent: React.FC = () => {
  const { 
    viewMode, 
    setViewMode, 
    projectHistory, 
    startNewProject, 
    openProjectFromHistory 
  } = useProject();

  // Landing page view
  if (viewMode === 'landing') {
    return (
      <MainLayout>
        <LandingPage
          onCreateNew={startNewProject}
          onViewHistory={() => setViewMode('history')}
          hasProjects={projectHistory.length > 0}
        />
      </MainLayout>
    );
  }

  // History view
  if (viewMode === 'history') {
    return (
      <MainLayout>
        <ProjectHistory
          projects={projectHistory}
          onBack={() => setViewMode('landing')}
          onSelectProject={openProjectFromHistory}
        />
      </MainLayout>
    );
  }

  // Workflow view
  return (
    <MainLayout>
      <WorkflowContent />
    </MainLayout>
  );
};

const Index: React.FC = () => {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
};

export default Index;
