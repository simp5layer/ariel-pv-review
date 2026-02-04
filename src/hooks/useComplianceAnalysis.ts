import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ComplianceFinding, SeverityLevel, ActionType } from '@/types/project';

interface AnalysisResult {
  findings: ComplianceFinding[];
  compliancePercentage: number;
  summary: string;
  standardsUsed: string[];
  tokensUsed: number;
}

interface ProjectFileContent {
  name: string;
  content: string;
}

export function useComplianceAnalysis() {
  const { session } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeCompliance = async (
    projectId: string,
    projectFiles: ProjectFileContent[]
  ): Promise<AnalysisResult | null> => {
    if (!session?.access_token) {
      toast.error('You must be logged in to run compliance analysis');
      return null;
    }

    if (projectFiles.length === 0) {
      toast.error('No project files to analyze');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-compliance', {
        body: {
          projectId,
          projectFiles,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        if (data.error.includes('No standards found')) {
          toast.warning('No standards uploaded. Please add standards to the library first.');
          setError(data.error);
          return null;
        }
        throw new Error(data.error);
      }

      // Map the findings to our type
      const mappedFindings: ComplianceFinding[] = (data.findings || []).map((f: any, idx: number) => ({
        id: f.issueId || `finding-${idx}`,
        issueId: f.issueId || `ISSUE-${idx + 1}`,
        name: f.name || 'Unnamed Finding',
        description: f.description || '',
        location: f.location || 'Unknown',
        standardReference: f.standardReference || 'N/A',
        severity: (f.severity || 'minor') as SeverityLevel,
        actionType: (f.actionType || 'recommendation') as ActionType,
        action: f.action || 'Review required',
        evidencePointer: f.evidencePointer,
        violatedRequirement: f.violatedRequirement,
        riskExplanation: f.riskExplanation,
        impactIfUnresolved: f.impactIfUnresolved,
      }));

      const analysisResult: AnalysisResult = {
        findings: mappedFindings,
        compliancePercentage: data.compliancePercentage || 0,
        summary: data.summary || 'Analysis complete',
        standardsUsed: data.standardsUsed || [],
        tokensUsed: data.tokensUsed || 0,
      };

      setResult(analysisResult);
      toast.success(`Analysis complete: ${mappedFindings.length} findings`);
      return analysisResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      console.error('Compliance analysis error:', err);
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    analyzeCompliance,
    isAnalyzing,
    result,
    error,
    reset,
  };
}
