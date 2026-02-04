import { useState, useCallback } from 'react';
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

interface ProcessingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result: AnalysisResult | null;
  error: string | null;
}

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 90; // 3 minutes max

export function useComplianceAnalysis() {
  const { session } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const pollJobStatus = useCallback(async (jobId: string): Promise<AnalysisResult | null> => {
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts++;

      const { data, error: pollError } = await supabase
        .from("processing_jobs")
        .select("status, progress, result, error")
        .eq("id", jobId)
        .single();

      if (pollError) {
        console.error("Error polling job status:", pollError);
        throw new Error("Failed to retrieve job status");
      }

      // Update progress
      setProgress(data.progress || 0);

      if (data.status === "completed") {
        const jobResult = data.result as any;
        if (!jobResult) {
          throw new Error("Job completed but no result found");
        }

        // Map findings to our type
        const mappedFindings: ComplianceFinding[] = (jobResult.findings || []).map((f: any, idx: number) => ({
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

        return {
          findings: mappedFindings,
          compliancePercentage: jobResult.compliancePercentage || 0,
          summary: jobResult.summary || 'Analysis complete',
          standardsUsed: jobResult.standardsUsed || [],
          tokensUsed: jobResult.tokensUsed || 0,
        };
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Job failed with unknown error");
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }

    throw new Error("Analysis timed out. Please try again.");
  }, []);

  const analyzeCompliance = async (
    projectId: string,
    projectFiles: ProjectFileContent[]
  ): Promise<AnalysisResult | null> => {
    if (!session?.access_token) {
      toast.error('You must be logged in to run compliance analysis');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      // Start the async job
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

      // If we got a jobId, poll for results
      if (data.jobId) {
        toast.info('Analysis started. This may take a minute...');
        const analysisResult = await pollJobStatus(data.jobId);
        setResult(analysisResult);
        toast.success(`Analysis complete: ${analysisResult?.findings.length || 0} findings`);
        return analysisResult;
      }

      // Fallback for legacy direct response (shouldn't happen now)
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
      setProgress(100);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setProgress(0);
  };

  return {
    analyzeCompliance,
    isAnalyzing,
    result,
    error,
    progress,
    reset,
  };
}
