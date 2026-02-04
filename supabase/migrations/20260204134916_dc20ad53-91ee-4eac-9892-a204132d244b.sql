-- Add unique constraint for deliverables upsert
ALTER TABLE public.deliverables ADD CONSTRAINT deliverables_submission_type_unique UNIQUE (submission_id, type);