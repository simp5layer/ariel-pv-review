-- Create enum types for project status, severity, deliverable status
CREATE TYPE project_status AS ENUM ('draft', 'setup', 'analyzing', 'standards', 'reviewing', 'completed');
CREATE TYPE system_type AS ENUM ('standalone', 'on-grid', 'hybrid');
CREATE TYPE severity_level AS ENUM ('critical', 'major', 'minor', 'pass');
CREATE TYPE action_type AS ENUM ('corrective', 'recommendation');
CREATE TYPE deliverable_type AS ENUM ('ai_prompt_log', 'design_review_report', 'issue_register', 'compliance_checklist', 'recalculation_sheet', 'redline_notes', 'bom_boq', 'risk_reflection');
CREATE TYPE deliverable_status AS ENUM ('not_generated', 'generated', 'updated');
CREATE TYPE standard_category AS ENUM ('IEC', 'SEC', 'SBC', 'SASO', 'MOMRA', 'SERA', 'WERA', 'NEC', 'OTHER');
CREATE TYPE ai_prompt_type AS ENUM ('extraction', 'calculation', 'compliance', 'optimization');
CREATE TYPE file_type AS ENUM ('dwg', 'pdf', 'excel', 'datasheet', 'standard');
CREATE TYPE file_status AS ENUM ('pending', 'processing', 'completed', 'error');

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  system_type system_type NOT NULL DEFAULT 'on-grid',
  status project_status NOT NULL DEFAULT 'draft',
  use_project_specific_standards BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project files table
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type file_type NOT NULL,
  size BIGINT NOT NULL,
  storage_path TEXT,
  source_reference TEXT,
  status file_status NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Global standards library
CREATE TABLE public.standards_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  version TEXT,
  category standard_category NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT,
  is_global BOOLEAN NOT NULL DEFAULT true,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Extracted data from project files
CREATE TABLE public.extracted_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  layers JSONB DEFAULT '[]'::jsonb,
  text_labels JSONB DEFAULT '[]'::jsonb,
  cable_summary JSONB DEFAULT '{}'::jsonb,
  pv_parameters JSONB DEFAULT '{}'::jsonb,
  module_parameters JSONB,
  inverter_parameters JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Submissions (review attempts)
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  compliance_percentage INTEGER DEFAULT 0
);

-- Compliance findings
CREATE TABLE public.compliance_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  standard_reference TEXT,
  action_type action_type NOT NULL,
  severity severity_level NOT NULL,
  action TEXT NOT NULL,
  evidence_pointer TEXT,
  verification_method TEXT,
  violated_requirement TEXT,
  risk_explanation TEXT,
  impact_if_unresolved TEXT,
  calculation_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deliverables
CREATE TABLE public.deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  type deliverable_type NOT NULL,
  name TEXT NOT NULL,
  status deliverable_status NOT NULL DEFAULT 'not_generated',
  content TEXT,
  storage_path TEXT,
  generated_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- AI Prompt Logs for auditability
CREATE TABLE public.ai_prompt_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  prompt_type ai_prompt_type NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'openai/gpt-5.2',
  tokens_used INTEGER,
  validation_status TEXT,
  correction_notes TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standards_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for project_files
CREATE POLICY "Users can view their project files" ON public.project_files FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create project files" ON public.project_files FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update their project files" ON public.project_files FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete their project files" ON public.project_files FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

-- RLS Policies for standards_library (global standards visible to all authenticated users)
CREATE POLICY "Authenticated users can view global standards" ON public.standards_library FOR SELECT 
  USING (auth.uid() IS NOT NULL AND (is_global = true OR user_id = auth.uid()));
CREATE POLICY "Users can create standards" ON public.standards_library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own standards" ON public.standards_library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own standards" ON public.standards_library FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for extracted_data
CREATE POLICY "Users can view their extracted data" ON public.extracted_data FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = extracted_data.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create extracted data" ON public.extracted_data FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = extracted_data.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update their extracted data" ON public.extracted_data FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = extracted_data.project_id AND projects.user_id = auth.uid()));

-- RLS Policies for submissions
CREATE POLICY "Users can view their submissions" ON public.submissions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = submissions.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create submissions" ON public.submissions FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = submissions.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update their submissions" ON public.submissions FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = submissions.project_id AND projects.user_id = auth.uid()));

-- RLS Policies for compliance_findings
CREATE POLICY "Users can view their findings" ON public.compliance_findings FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.submissions s 
    JOIN public.projects p ON p.id = s.project_id 
    WHERE s.id = compliance_findings.submission_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can create findings" ON public.compliance_findings FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.submissions s 
    JOIN public.projects p ON p.id = s.project_id 
    WHERE s.id = compliance_findings.submission_id AND p.user_id = auth.uid()));

-- RLS Policies for deliverables
CREATE POLICY "Users can view their deliverables" ON public.deliverables FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.submissions s 
    JOIN public.projects p ON p.id = s.project_id 
    WHERE s.id = deliverables.submission_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can create deliverables" ON public.deliverables FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.submissions s 
    JOIN public.projects p ON p.id = s.project_id 
    WHERE s.id = deliverables.submission_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update their deliverables" ON public.deliverables FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.submissions s 
    JOIN public.projects p ON p.id = s.project_id 
    WHERE s.id = deliverables.submission_id AND p.user_id = auth.uid()));

-- RLS Policies for ai_prompt_logs
CREATE POLICY "Users can view their AI logs" ON public.ai_prompt_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = ai_prompt_logs.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can create AI logs" ON public.ai_prompt_logs FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = ai_prompt_logs.project_id AND projects.user_id = auth.uid()));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_extracted_data_updated_at
  BEFORE UPDATE ON public.extracted_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX idx_standards_library_category ON public.standards_library(category);
CREATE INDEX idx_standards_library_is_global ON public.standards_library(is_global);
CREATE INDEX idx_submissions_project_id ON public.submissions(project_id);
CREATE INDEX idx_compliance_findings_submission_id ON public.compliance_findings(submission_id);
CREATE INDEX idx_deliverables_submission_id ON public.deliverables(submission_id);
CREATE INDEX idx_ai_prompt_logs_project_id ON public.ai_prompt_logs(project_id);