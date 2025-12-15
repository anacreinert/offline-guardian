import { useState, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

export interface CapturedPhoto {
  dataUrl: string;
  format: string;
  timestamp: Date;
}

export function useCamera() {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    setIsCapturing(true);
    setError(null);
    
    try {
      const photo: Photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
        width: 1280,
        height: 960,
      });

      if (photo.dataUrl) {
        const capturedPhoto: CapturedPhoto = {
          dataUrl: photo.dataUrl,
          format: photo.format,
          timestamp: new Date(),
        };
        
        setPhotos(prev => [...prev, capturedPhoto]);
        return capturedPhoto;
      }
      
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao capturar foto';
      setError(message);
      console.error('Camera error:', err);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const pickFromGallery = useCallback(async (): Promise<CapturedPhoto | null> => {
    setIsCapturing(true);
    setError(null);
    
    try {
      const photo: Photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        correctOrientation: true,
      });

      if (photo.dataUrl) {
        const capturedPhoto: CapturedPhoto = {
          dataUrl: photo.dataUrl,
          format: photo.format,
          timestamp: new Date(),
        };
        
        setPhotos(prev => [...prev, capturedPhoto]);
        return capturedPhoto;
      }
      
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao selecionar foto';
      setError(message);
      console.error('Gallery error:', err);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      const permissions = await Camera.checkPermissions();
      return permissions;
    } catch {
      return null;
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      const permissions = await Camera.requestPermissions();
      return permissions;
    } catch {
      return null;
    }
  }, []);

  return {
    photos,
    isCapturing,
    error,
    takePhoto,
    pickFromGallery,
    removePhoto,
    clearPhotos,
    checkPermissions,
    requestPermissions,
  };
}
