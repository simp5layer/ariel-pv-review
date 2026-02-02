import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Project, UploadedFile, ExtractedData, ComplianceFinding, Submission, SeverityLevel } from '@/types/project';

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
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

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

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

  // Simulate data extraction after analysis
  const handleSetExtractedData = (data: ExtractedData | null) => {
    if (data === null && isAnalyzing) {
      // Simulate analysis completion
      setTimeout(() => {
        setExtractedData(mockExtractedData);
        setIsAnalyzing(false);
      }, 3000);
    } else {
      setExtractedData(data);
    }
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
        currentStep,
        setCurrentStep,
        extractedData,
        setExtractedData: handleSetExtractedData,
        findings,
        setFindings,
        submissions,
        addSubmission,
        isAnalyzing,
        setIsAnalyzing,
        isReviewing,
        setIsReviewing: handleSetIsReviewing,
        addProjectFile,
        addStandardFile
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
