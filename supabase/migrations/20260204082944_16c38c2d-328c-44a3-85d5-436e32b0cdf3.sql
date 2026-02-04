-- Create storage bucket for project files and standards
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('standards', 'standards', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('deliverables', 'deliverables', false);

-- Storage policies for project-files bucket
CREATE POLICY "Users can upload project files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their project files"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their project files"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for standards bucket
CREATE POLICY "Users can upload standards"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'standards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their standards"
ON storage.objects FOR SELECT
USING (bucket_id = 'standards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their standards"
ON storage.objects FOR DELETE
USING (bucket_id = 'standards' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for deliverables bucket
CREATE POLICY "Users can upload deliverables"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their deliverables"
ON storage.objects FOR SELECT
USING (bucket_id = 'deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their deliverables"
ON storage.objects FOR DELETE
USING (bucket_id = 'deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);