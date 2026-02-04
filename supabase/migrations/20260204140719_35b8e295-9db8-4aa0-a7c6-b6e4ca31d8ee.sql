-- Allow deliverables generation jobs
ALTER TABLE public.processing_jobs
  DROP CONSTRAINT IF EXISTS processing_jobs_job_type_check;

ALTER TABLE public.processing_jobs
  ADD CONSTRAINT processing_jobs_job_type_check
  CHECK (job_type = ANY (ARRAY['extraction'::text, 'compliance'::text, 'deliverables'::text]));
