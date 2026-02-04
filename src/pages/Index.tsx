import React from 'react';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import MainLayout from '@/components/layout/MainLayout';
import LandingPage from '@/components/workflow/LandingPage';
import ProjectHistory from '@/components/workflow/ProjectHistory';
import ProjectSetup from '@/components/workflow/ProjectSetup';
import AnalyzeExtract from '@/components/workflow/AnalyzeExtract';
import DesignReview from '@/components/workflow/DesignReview';
import StandardsLibrary from '@/components/workflow/StandardsLibrary';

const WorkflowContent: React.FC = () => {
  const { currentStep, currentProject } = useProject();

  // If no project, always show setup
  if (!currentProject) {
    return <ProjectSetup />;
  }

  // Render step based on current step (3-step workflow: Setup -> Analyze -> Review)
  switch (currentStep) {
    case 0:
      return <ProjectSetup />;
    case 1:
      return <AnalyzeExtract />;
    case 2:
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
    openProjectFromHistory,
    deleteProjectFromHistory,
    updateProjectInHistory
  } = useProject();

  // Landing page view
  if (viewMode === 'landing') {
    return (
      <MainLayout>
        <LandingPage
          onCreateNew={startNewProject}
          onViewHistory={() => setViewMode('history')}
          onOpenStandardsLibrary={() => setViewMode('standards')}
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
          onDeleteProject={deleteProjectFromHistory}
          onUpdateProject={updateProjectInHistory}
        />
      </MainLayout>
    );
  }

  // Standards Library view
  if (viewMode === 'standards') {
    return (
      <MainLayout>
        <StandardsLibrary onBack={() => setViewMode('landing')} />
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
