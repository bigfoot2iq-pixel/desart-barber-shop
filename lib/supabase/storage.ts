import { createClient } from '@/lib/supabase/client';

const BUCKET_NAME = 'desart-barber-shop';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadImageOptions {
  file: File;
  folder: 'professionals' | 'salons';
  entityId?: string;
}

export async function uploadImage({ file, folder, entityId }: UploadImageOptions): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 5MB limit');
  }

  const supabase = createClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const fileName = entityId ? `${entityId}-${timestamp}.${ext}` : `${folder}-${timestamp}-${randomId}.${ext}`;
  const path = `${folder}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrl;
}

export async function deleteImage(url: string): Promise<void> {
  const supabase = createClient();
  const urlParts = url.split('/');
  const fileName = urlParts[urlParts.length - 1];
  const folder = urlParts[urlParts.length - 2];
  const path = `${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}
