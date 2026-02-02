export type SystemType = 'standalone' | 'on-grid' | 'hybrid';

export type SeverityLevel = 'critical' | 'major' | 'minor' | 'pass';

export type ActionType = 'corrective' | 'recommendation';

export interface UploadedFile {
  id: string;
  name: string;
  type: 'dwg' | 'pdf' | 'excel' | 'datasheet' | 'standard';
  size: number;
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface Project {
  id: string;
  name: string;
  location: string;
  systemType: SystemType;
  createdAt: Date;
  updatedAt: Date;
  status: 'setup' | 'analyzing' | 'standards' | 'reviewing' | 'completed';
  files: UploadedFile[];
  standardFiles: UploadedFile[];
}

export interface ExtractedData {
  layers: string[];
  textLabels: string[];
  cableSummary: {
    dcLength: number;
    acLength: number;
  };
  pvParameters: {
    moduleCount: number;
    inverterCount: number;
    stringCount: number;
    maxVoltage: number;
    totalCapacity: number;
  };
}

export interface ComplianceFinding {
  id: string;
  issueId: string;
  name: string;
  description: string;
  location: string;
  standardReference: string;
  actionType: ActionType;
  severity: SeverityLevel;
  action: string;
}

export interface Submission {
  id: string;
  submittedBy: string;
  submittedAt: Date;
  completedAt: Date | null;
  status: 'pending' | 'passed' | 'failed';
  compliancePercentage: number;
  findings: ComplianceFinding[];
}

export interface ProjectReview {
  projectId: string;
  submissions: Submission[];
  currentCompliancePercentage: number;
}
