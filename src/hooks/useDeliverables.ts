import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Deliverable, DeliverableType, ComplianceFinding, ExtractedData } from '@/types/project';

interface GenerationResult {
  generated: DeliverableType[];
  totalGenerated: number;
  submissionId?: string;
}

const POLL_INTERVAL = 2000;
const MAX_POLL_ATTEMPTS = 90;

export function useDeliverables() {
  const { session } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const pollJobStatus = useCallback(async (jobId: string): Promise<GenerationResult | null> => {
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts++;

      const { data, error } = await supabase
        .from("processing_jobs")
        .select("status, progress, result, error")
        .eq("id", jobId)
        .single();

      if (error) {
        console.error("Error polling job status:", error);
        throw new Error("Failed to retrieve job status");
      }

      setProgress(data.progress || 0);

      if (data.status === "completed") {
        const jobResult = data.result as unknown as GenerationResult;
        return jobResult;
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Generation failed");
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }

    throw new Error("Generation timed out. Please try again.");
  }, []);

  const generateMissingDeliverables = async (
    projectId: string,
    findings: ComplianceFinding[],
    extractedData: ExtractedData | null,
    submissionId?: string
  ): Promise<GenerationResult | null> => {
    if (!session?.access_token) {
      toast.error('You must be logged in to generate deliverables');
      return null;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-deliverables', {
        body: {
          projectId,
          submissionId,
          findings,
          extractedData,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
        console.error('Edge function invocation error:', fnError);
        throw new Error(fnError.message || 'Failed to invoke generate-deliverables');
      }

      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        throw new Error(data.error);
      }

      if (data?.jobId) {
        toast.info('Generating deliverables. This may take a moment...');
        const result = await pollJobStatus(data.jobId);
        toast.success(`Generated ${result?.totalGenerated || 0} deliverables`);
        return { ...result, submissionId: data.submissionId };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      console.error('Deliverables generation error:', err);
      toast.error(message);
      return null;
    } finally {
      setIsGenerating(false);
      setProgress(100);
    }
  };

  const fetchDeliverables = async (submissionId: string): Promise<Deliverable[]> => {
    const { data, error } = await supabase
      .from('deliverables')
      .select('*')
      .eq('submission_id', submissionId)
      .order('type');

    if (error) {
      console.error('Error fetching deliverables:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      type: d.type as DeliverableType,
      name: d.name,
      status: d.status as Deliverable['status'],
      generatedAt: d.generated_at ? new Date(d.generated_at) : undefined,
      updatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
      content: d.content || undefined,
      downloadUrl: d.storage_path || undefined,
    }));
  };

  return {
    generateMissingDeliverables,
    fetchDeliverables,
    isGenerating,
    progress,
  };
}
