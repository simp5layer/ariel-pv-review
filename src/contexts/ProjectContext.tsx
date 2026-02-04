import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Project, UploadedFile, ExtractedData, ComplianceFinding, Submission, Deliverable, DeliverableType, StandardDocument } from '@/types/project';

type ViewMode = 'landing' | 'workflow' | 'history' | 'standards';

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projectHistory: Project[];
  addToHistory: (project: Project) => void;
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
  startAnalysis: () => void;
  startNewProject: () => void;
  openProjectFromHistory: (project: Project) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Mock extracted data for demo
const mockExtractedData: ExtractedData = {
  layers: [
    'PV_MODULES',
    'DC_CABLES',
    'AC_CABLES',
    'INVERTERS',
    'TRANSFORMERS',
    'GROUNDING',
    'DIMENSIONS',
    'ANNOTATIONS'
  ],
  textLabels: [
    'INV-01: 500kW Central Inverter',
    'STRING-A01 to STRING-A24',
    'DC CABLE: 6mm² Cu',
    'AC CABLE: 3x240mm² Al',
    'Module: 550W Bifacial',
    'Grounding: 70mm² Cu bare'
  ],
  cableSummary: {
    dcLength: 12450,
    acLength: 3200
  },
  pvParameters: {
    moduleCount: 4320,
    inverterCount: 6,
    stringCount: 180,
    maxVoltage: 1500,
    totalCapacity: 2376
  }
};

// Mock compliance findings for demo
const mockFindings: ComplianceFinding[] = [
  {
    id: '1',
    issueId: 'NCR-001',
    name: 'DC Cable Voltage Drop Exceeds Limit',
    description: 'The calculated DC cable voltage drop is 3.2%, exceeding the maximum 2% allowed by SEC standards for PV installations.',
    location: 'String A01-A12, Drawing PV-EL-001',
    standardReference: 'SEC Distribution Code Section 4.3.2 - Maximum voltage drop for DC circuits shall not exceed 2%',
    actionType: 'corrective',
    severity: 'critical',
    action: 'Increase DC cable cross-section from 6mm² to 10mm² or reduce string cable length by repositioning combiner boxes.'
  },
  {
    id: '2',
    issueId: 'NCR-002',
    name: 'Missing Surge Protection Device',
    description: 'Type II SPD not indicated on DC side of inverter INV-03 and INV-04.',
    location: 'Inverter Station 2, Drawing PV-EL-003',
    standardReference: 'IEC 62305-4 Clause 6.2 - Lightning protection shall include Type II SPD on all DC inputs',
    actionType: 'corrective',
    severity: 'major',
    action: 'Add Type II SPD rated for 1500VDC at DC input of inverters INV-03 and INV-04.'
  },
  {
    id: '3',
    issueId: 'NCR-003',
    name: 'Grounding Conductor Undersized',
    description: 'Equipment grounding conductor shown as 35mm² Cu, but calculated fault current requires minimum 50mm².',
    location: 'Transformer Station, Drawing PV-EL-005',
    standardReference: 'NEC 250.122 Table - Equipment grounding conductor sizing based on overcurrent device rating',
    actionType: 'corrective',
    severity: 'major',
    action: 'Upgrade grounding conductor from 35mm² Cu to minimum 50mm² Cu bare conductor.'
  },
  {
    id: '4',
    issueId: 'OBS-001',
    name: 'String Fuse Rating Optimization',
    description: 'String fuses rated at 20A while module Isc is 13.8A. Consider 15A fuses for better protection.',
    location: 'All Combiner Boxes',
    standardReference: 'IEC 62548 Clause 5.4 - Fuse rating should be 1.1 to 1.5 times module Isc',
    actionType: 'recommendation',
    severity: 'minor',
    action: 'Consider replacing 20A fuses with 15A fuses (1.1 x 13.8A = 15.2A) for improved fault discrimination.'
  },
  {
    id: '5',
    issueId: 'PASS-001',
    name: 'Module Tilt Angle Verification',
    description: 'Tilt angle of 25° is optimal for site latitude of 24.7°N.',
    location: 'All Module Arrays',
    standardReference: 'Best Practice - Optimal tilt = Latitude ± 5°',
    actionType: 'recommendation',
    severity: 'pass',
    action: 'No action required. Design is compliant.'
  },
  {
    id: '6',
    issueId: 'PASS-002',
    name: 'Inverter DC/AC Ratio',
    description: 'DC/AC ratio of 1.25 is within acceptable limits for Saudi Arabia climate conditions.',
    location: 'System Design',
    standardReference: 'SEC Technical Standards for PV - DC/AC ratio 1.1 to 1.3',
    actionType: 'recommendation',
    severity: 'pass',
    action: 'No action required. Design is compliant.'
  }
];

// Demo project history
const demoProjectHistory: Project[] = [
  {
    id: 'proj-demo-1',
    name: 'NEOM Solar Farm Phase 1',
    location: 'NEOM, Saudi Arabia',
    systemType: 'on-grid',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    status: 'completed',
    files: [
      { id: 'f1', name: 'PV-Layout-01.dwg', type: 'dwg', size: 2500000, uploadedAt: new Date(), status: 'completed' },
      { id: 'f2', name: 'Electrical-Diagram.pdf', type: 'pdf', size: 1200000, uploadedAt: new Date(), status: 'completed' }
    ],
    standardFiles: []
  },
  {
    id: 'proj-demo-2',
    name: 'Riyadh Commercial Center',
    location: 'Riyadh, Saudi Arabia',
    systemType: 'hybrid',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-10'),
    status: 'completed',
    files: [
      { id: 'f3', name: 'Site-Plan.dwg', type: 'dwg', size: 3200000, uploadedAt: new Date(), status: 'completed' }
    ],
    standardFiles: []
  }
];

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

  const addToHistory = (project: Project) => {
    setProjectHistory(prev => {
      const exists = prev.find(p => p.id === project.id);
      if (exists) {
        return prev.map(p => p.id === project.id ? project : p);
      }
      return [project, ...prev];
    });
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
    // Determine the step based on project status
    switch (project.status) {
      case 'completed':
      case 'reviewing':
        setCurrentStep(3);
        break;
      case 'standards':
        setCurrentStep(2);
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

  // Start analysis simulation
  const startAnalysis = () => {
    setIsAnalyzing(true);
    setExtractedData(null);
    // Simulate analysis completion after 2 seconds
    setTimeout(() => {
      setExtractedData(mockExtractedData);
      setIsAnalyzing(false);
    }, 2000);
  };

  // Simulate review completion
  const handleSetIsReviewing = (reviewing: boolean) => {
    setIsReviewing(reviewing);
    if (reviewing) {
      setTimeout(() => {
        setFindings(mockFindings);
        setIsReviewing(false);
        
        // Calculate compliance
        const passCount = mockFindings.filter(f => f.severity === 'pass').length;
        const compliancePercentage = Math.round((passCount / mockFindings.length) * 100);
        
        const newSubmission: Submission = {
          id: `SUB-${Date.now()}`,
          submittedBy: 'Engineer User',
          submittedAt: new Date(),
          completedAt: new Date(),
          status: compliancePercentage >= 80 ? 'passed' : 'failed',
          compliancePercentage,
          findings: mockFindings
        };
        addSubmission(newSubmission);
      }, 4000);
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        setCurrentProject,
        projectHistory,
        addToHistory,
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
        setIsReviewing: handleSetIsReviewing,
        addProjectFile,
        addStandardFile,
        startAnalysis,
        startNewProject,
        openProjectFromHistory
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
