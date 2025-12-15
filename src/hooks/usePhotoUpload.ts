import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PhotoData } from '@/types/weighing';

export function usePhotoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = async (photo: PhotoData, recordId: string, userId: string): Promise<string | null> => {
    setIsUploading(true);
    setError(null);

    try {
      // Convert data URL to blob
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();

      // Generate unique filename
      const timestamp = new Date().getTime();
      const extension = photo.format === 'png' ? 'png' : 'jpg';
      const filePath = `${userId}/${recordId}/${photo.category}_${timestamp}.${extension}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('weighing-photos')
        .upload(filePath, blob, {
          contentType: `image/${extension}`,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(uploadError.message);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('weighing-photos')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      console.error('Photo upload error:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const uploadMultiplePhotos = async (
    photos: PhotoData[],
    recordId: string,
    userId: string
  ): Promise<Record<string, string>> => {
    const urls: Record<string, string> = {};

    for (const photo of photos) {
      const url = await uploadPhoto(photo, recordId, userId);
      if (url) {
        urls[photo.category] = url;
      }
    }

    return urls;
  };

  return {
    isUploading,
    error,
    uploadPhoto,
    uploadMultiplePhotos,
  };
}
