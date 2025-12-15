-- Create storage bucket for weighing photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('weighing-photos', 'weighing-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'weighing-photos');

-- Allow authenticated users to view photos
CREATE POLICY "Authenticated users can view photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'weighing-photos');

-- Allow users to update their own photos
CREATE POLICY "Users can update their own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'weighing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'weighing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);