-- Allow public read access to the desart-barber-shop bucket
CREATE POLICY "Public read access for desart-barber-shop"
ON storage.objects FOR SELECT
USING (bucket_id = 'desart-barber-shop');

-- Allow admins to upload images to professionals/ folder
CREATE POLICY "Admins can upload professional images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'desart-barber-shop'
  AND (storage.foldername(name))[1] = 'professionals'
  AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

-- Allow admins to upload images to salons/ folder
CREATE POLICY "Admins can upload salon images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'desart-barber-shop'
  AND (storage.foldername(name))[1] = 'salons'
  AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

-- Allow admins to update their uploaded images
CREATE POLICY "Admins can update professional images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'desart-barber-shop'
  AND (storage.foldername(name))[1] = 'professionals'
  AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

CREATE POLICY "Admins can update salon images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'desart-barber-shop'
  AND (storage.foldername(name))[1] = 'salons'
  AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

-- Allow admins to delete images
CREATE POLICY "Admins can delete professional images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'desart-barber-shop'
  AND (storage.foldername(name))[1] = 'professionals'
  AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

CREATE POLICY "Admins can delete salon images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'desart-barber-shop'
  AND (storage.foldername(name))[1] = 'salons'
  AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
);
