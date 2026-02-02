import React from 'react';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import MainLayout from '@/components/layout/MainLayout';
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

const Index: React.FC = () => {
  return (
    <ProjectProvider>
      <MainLayout>
        <WorkflowContent />
      </MainLayout>
    </ProjectProvider>
  );
};

export default Index;
