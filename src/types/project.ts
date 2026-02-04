export type SystemType = 'standalone' | 'on-grid' | 'hybrid';

export type SeverityLevel = 'critical' | 'major' | 'minor' | 'pass';

export type ActionType = 'corrective' | 'recommendation';

export type DeliverableType = 
  | 'ai_prompt_log'
  | 'design_review_report'
  | 'issue_register'
  | 'compliance_checklist'
  | 'recalculation_sheet'
  | 'redline_notes'
  | 'bom_boq'
  | 'risk_reflection';

export type DeliverableStatus = 'not_generated' | 'generated' | 'updated';

export interface UploadedFile {
  id: string;
  name: string;
  type: 'dwg' | 'pdf' | 'excel' | 'datasheet' | 'standard';
  size: number;
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'error';
  sourceReference?: string; // page number or cell reference
  storagePath?: string; // path in Supabase storage
}

export interface Project {
  id: string;
  name: string;
  location: string;
  systemType: SystemType;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'setup' | 'analyzing' | 'standards' | 'reviewing' | 'completed';
  files: UploadedFile[];
  standardFiles: UploadedFile[];
  useProjectSpecificStandards?: boolean;
}

export interface ExtractedParameter {
  value: string | number;
  sourceFile: string;
  sourceReference: string; // page number or Excel cell
  unit?: string;
}

export interface SourcePointer {
  sourceFile: string;
  sourceReference: string; // page number or Excel cell
}

export interface BomBoqItem {
  category: string; // e.g. Modules, Inverters, DC Cable, Structures, Protection
  description: string;
  quantity: number | null;
  unit: string;
  specification?: string;
  source?: SourcePointer;
  notes?: string;
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
    arrayCount?: number;
    maxVoltage: number;
    totalCapacity: number;
  };
  /** Bill of Materials (components list) */
  bom?: BomBoqItem[];
  /** Bill of Quantities (measured / takeoff quantities) */
  boq?: BomBoqItem[];
  /** Traceability for key scalar outputs (counts, lengths, voltages, etc.) */
  trace?: Record<string, ExtractedParameter>;
  /** Missing fields and why they could not be extracted */
  missingData?: { field: string; reason: string; sourceHint?: string }[];
  /** High-level notes (e.g. PDF has no extractable text) */
  notes?: string[];
  // Enhanced extraction with source traceability
  moduleParameters?: {
    voc: ExtractedParameter;
    vmp: ExtractedParameter;
    isc: ExtractedParameter;
    imp: ExtractedParameter;
    pmax: ExtractedParameter;
    tempCoeffVoc?: ExtractedParameter;
    tempCoeffPmax?: ExtractedParameter;
  };
  inverterParameters?: {
    maxDcVoltage: ExtractedParameter;
    mpptRangeLow: ExtractedParameter;
    mpptRangeHigh: ExtractedParameter;
    maxInputCurrent: ExtractedParameter;
    maxStringsPerMppt: ExtractedParameter;
  };
}

export interface CalculationResult {
  formula: string;
  inputs: { name: string; value: number | string; source: string }[];
  result: number | string;
  unit?: string;
  passFailStatus: 'pass' | 'fail' | 'warning' | 'insufficient_data';
  limit?: number | string;
  limitSource?: string;
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
  // Enhanced fields for Futurethon compliance
  evidencePointer?: string; // file name + page/cell reference
  verificationMethod?: string;
  violatedRequirement?: string;
  riskExplanation?: string;
  impactIfUnresolved?: string;
  calculationResult?: CalculationResult;
}

export interface AIPromptLog {
  id: string;
  timestamp: Date;
  promptType: 'extraction' | 'calculation' | 'compliance' | 'optimization';
  prompt: string;
  response: string;
  model: string;
  tokensUsed?: number;
  validationStatus?: 'validated' | 'corrected' | 'rejected';
  correctionNotes?: string;
}

export interface Deliverable {
  id: string;
  type: DeliverableType;
  name: string;
  status: DeliverableStatus;
  generatedAt?: Date;
  updatedAt?: Date;
  submissionNumber?: number;
  content?: string;
  downloadUrl?: string;
}

export interface Submission {
  id: string;
  submittedBy: string;
  submittedAt: Date;
  completedAt: Date | null;
  status: 'pending' | 'passed' | 'failed';
  compliancePercentage: number;
  findings: ComplianceFinding[];
  deliverables?: Deliverable[];
  aiPromptLogs?: AIPromptLog[];
}

export interface StandardDocument {
  id: string;
  name: string;
  version?: string;
  category: 'IEC' | 'SEC' | 'SBC' | 'SASO' | 'MOMRA' | 'SERA' | 'WERA' | 'NEC' | 'OTHER';
  uploadedAt: Date;
  file: UploadedFile;
  isGlobal: boolean; // true = global library, false = project-specific
  projectId?: string; // only for project-specific standards
}

export interface ProjectReview {
  projectId: string;
  submissions: Submission[];
  currentCompliancePercentage: number;
}

// Deliverable metadata for UI display
export const DELIVERABLE_METADATA: Record<DeliverableType, { name: string; description: string; icon: string }> = {
  ai_prompt_log: {
    name: 'AI Prompt Log',
    description: 'Full prompt/output traceability for all AI interactions',
    icon: '🤖'
  },
  design_review_report: {
    name: 'Design Review Report',
    description: 'Comprehensive review with executive summary',
    icon: '📋'
  },
  issue_register: {
    name: 'Issue Register (NCR)',
    description: 'Non-conformity log with P0/P1/P2 severity',
    icon: '⚠️'
  },
  compliance_checklist: {
    name: 'Standards Compliance Checklist',
    description: 'IEC/SBC/SEC/SASO/SERA/MOMRA verification',
    icon: '✅'
  },
  recalculation_sheet: {
    name: 'Recalculation Sheet',
    description: 'Explicit formulas and results verification',
    icon: '🔢'
  },
  redline_notes: {
    name: 'Redline Notes',
    description: 'Written redline list for PDF drawings',
    icon: '📝'
  },
  bom_boq: {
    name: 'Optimized BoM & BoQ',
    description: 'Bill of Materials/Quantities with justification',
    icon: '📦'
  },
  risk_reflection: {
    name: 'Risk Reflection',
    description: 'AI reliability and limitations assessment',
    icon: '⚖️'
  }
};
