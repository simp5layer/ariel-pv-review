-- Drop existing policies on standards bucket if they exist
DROP POLICY IF EXISTS "Users can upload standards" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their standards" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their standards" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to standards" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view standards" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own standards" ON storage.objects;

-- Create proper RLS policies for standards bucket
-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload to standards bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'standards' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view all standards (global library)
CREATE POLICY "Users can view standards bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'standards');

-- Allow users to update their own files
CREATE POLICY "Users can update own standards"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'standards' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own standards"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'standards' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);