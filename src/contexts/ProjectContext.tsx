import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Project, UploadedFile, ExtractedData, ComplianceFinding, Submission, Deliverable, DeliverableType, StandardDocument } from '@/types/project';

type ViewMode = 'landing' | 'workflow' | 'history' | 'standards';

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projectHistory: Project[];
  addToHistory: (project: Project) => void;
  deleteProjectFromHistory: (projectId: string) => void;
  updateProjectInHistory: (project: Project) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  extractedData: ExtractedData | null;
  setExtractedData: (data: ExtractedData | null) => void;
  findings: ComplianceFinding[];
  setFindings: (findings: ComplianceFinding[]) => void;
  submissions: Submission[];
  addSubmission: (submission: Submission) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  isReviewing: boolean;
  setIsReviewing: (reviewing: boolean) => void;
  addProjectFile: (file: UploadedFile) => void;
  addStandardFile: (file: UploadedFile) => void;
  startNewProject: () => void;
  openProjectFromHistory: (project: Project) => void;
  runComplianceReview: (projectFiles: { name: string; content: string }[]) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Empty project history - data comes from database
const demoProjectHistory: Project[] = [];

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectHistory, setProjectHistory] = useState<Project[]>(demoProjectHistory);
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [currentStep, setCurrentStep] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // Poll for job completion
  const pollJobStatus = async (
    supabase: any,
    jobId: string,
    maxAttempts = 90,
    interval = 2000
  ): Promise<any> => {
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("status, progress, result, error")
        .eq("id", jobId)
        .single();

      if (error) throw new Error("Failed to poll job status");

      if (data.status === "completed") {
        return data.result;
      }
      if (data.status === "failed") {
        throw new Error(data.error || "Job failed");
      }

      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error("Job timed out");
  };

  // Real compliance review function that calls edge function
  const runComplianceReview = async (projectFiles: { name: string; content: string }[]) => {
    if (!currentProject) return;
    
    setIsReviewing(true);
    setFindings([]);

    try {
      // Import dynamically to avoid circular dependencies
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('analyze-compliance', {
        body: {
          projectId: currentProject.id,
          projectFiles,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // If we got a jobId, poll for results
      let resultData = data;
      if (data.jobId) {
        resultData = await pollJobStatus(supabase, data.jobId);
      }

      if (resultData.findings && resultData.findings.length > 0) {
        // Map the AI findings to our type
        const mappedFindings: ComplianceFinding[] = resultData.findings.map((f: any, idx: number) => ({
          id: `finding-${idx}`,
          issueId: f.issueId || `NCR-${String(idx + 1).padStart(3, '0')}`,
          name: f.name || 'Unnamed Finding',
          description: f.description || '',
          location: f.location || 'Unknown',
          standardReference: f.standardReference || 'N/A',
          severity: f.severity || 'minor',
          actionType: f.actionType || 'recommendation',
          action: f.action || 'Review required',
          evidencePointer: f.evidencePointer,
          violatedRequirement: f.violatedRequirement,
          riskExplanation: f.riskExplanation,
          impactIfUnresolved: f.impactIfUnresolved,
        }));
        setFindings(mappedFindings);
        
        // Create submission
        const passCount = mappedFindings.filter(f => f.severity === 'pass').length;
        const totalChecks = mappedFindings.length;
        const calculatedCompliance = totalChecks > 0 
          ? Math.round((passCount / totalChecks) * 100) 
          : 100;
        const compliancePercentage = resultData.compliancePercentage ?? calculatedCompliance;
        
        const newSubmission: Submission = {
          id: `SUB-${Date.now()}`,
          submittedBy: 'Engineer User',
          submittedAt: new Date(),
          completedAt: new Date(),
          status: compliancePercentage >= 80 ? 'passed' : 'failed',
          compliancePercentage,
          findings: mappedFindings
        };
        addSubmission(newSubmission);
      } else {
        setFindings([]);
        console.warn('No compliance findings returned from AI analysis');
      }
    } catch (err) {
      console.error('Compliance review error:', err);
      setFindings([]);
      throw err instanceof Error ? err : new Error('Compliance analysis failed. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  const addToHistory = (project: Project) => {
    setProjectHistory(prev => {
      const exists = prev.find(p => p.id === project.id);
      if (exists) {
        return prev.map(p => p.id === project.id ? project : p);
      }
      return [project, ...prev];
    });
  };

  const deleteProjectFromHistory = (projectId: string) => {
    setProjectHistory(prev => prev.filter(p => p.id !== projectId));
  };

  const updateProjectInHistory = (project: Project) => {
    setProjectHistory(prev => prev.map(p => p.id === project.id ? project : p));
  };

  const startNewProject = () => {
    setCurrentProject(null);
    setCurrentStep(0);
    setExtractedData(null);
    setFindings([]);
    setSubmissions([]);
    setViewMode('workflow');
  };

  const openProjectFromHistory = (project: Project) => {
    setCurrentProject(project);
    // Determine the step based on project status (3-step workflow now)
    switch (project.status) {
      case 'completed':
      case 'reviewing':
        setCurrentStep(2); // Design Review is now step 2
        break;
      case 'analyzing':
        setCurrentStep(1);
        break;
      default:
        setCurrentStep(0);
    }
    setViewMode('workflow');
  };

  const addProjectFile = (file: UploadedFile) => {
    if (currentProject) {
      setCurrentProject({
        ...currentProject,
        files: [...currentProject.files, file]
      });
    }
  };

  const addStandardFile = (file: UploadedFile) => {
    if (currentProject) {
      setCurrentProject({
        ...currentProject,
        standardFiles: [...currentProject.standardFiles, file]
      });
    }
  };

  const addSubmission = (submission: Submission) => {
    setSubmissions([...submissions, submission]);
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        setCurrentProject,
        projectHistory,
        addToHistory,
        deleteProjectFromHistory,
        updateProjectInHistory,
        viewMode,
        setViewMode,
        currentStep,
        setCurrentStep,
        extractedData,
        setExtractedData,
        findings,
        setFindings,
        submissions,
        addSubmission,
        isAnalyzing,
        setIsAnalyzing,
        isReviewing,
        setIsReviewing,
        addProjectFile,
        addStandardFile,
        startNewProject,
        openProjectFromHistory,
        runComplianceReview
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
