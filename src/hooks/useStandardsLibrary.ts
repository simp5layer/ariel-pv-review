import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface StandardRecord {
  id: string;
  name: string;
  version: string | null;
  category: 'IEC' | 'SEC' | 'SBC' | 'SASO' | 'MOMRA' | 'SERA' | 'WERA' | 'NEC' | 'OTHER';
  fileName: string;
  fileSize: number;
  storagePath: string | null;
  uploadedAt: Date;
  isGlobal: boolean;
}

export function useStandardsLibrary() {
  const { user } = useAuth();
  const [standards, setStandards] = useState<StandardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch standards from database
  const fetchStandards = useCallback(async () => {
    if (!user) {
      setStandards([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('standards_library')
        .select('*')
        .eq('is_global', true)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      const mapped: StandardRecord[] = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        version: row.version,
        category: row.category,
        fileName: row.file_name,
        fileSize: row.file_size,
        storagePath: row.storage_path,
        uploadedAt: new Date(row.uploaded_at),
        isGlobal: row.is_global,
      }));

      setStandards(mapped);
    } catch (error) {
      console.error('Error fetching standards:', error);
      toast.error('Failed to load standards library');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStandards();
  }, [fetchStandards]);

  // Upload a file to storage and create database record
  const uploadStandard = async (file: File): Promise<StandardRecord | null> => {
    if (!user) {
      toast.error('You must be logged in to upload standards');
      return null;
    }

    setIsUploading(true);

    try {
      // Create unique storage path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${file.name}`;

      // Upload to storage bucket
      const { error: uploadError } = await supabase.storage
        .from('standards')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error: dbError } = await supabase
        .from('standards_library')
        .insert({
          user_id: user.id,
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for name
          file_name: file.name,
          file_size: file.size,
          storage_path: fileName,
          category: 'OTHER' as const,
          is_global: true,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const newStandard: StandardRecord = {
        id: data.id,
        name: data.name,
        version: data.version,
        category: data.category,
        fileName: data.file_name,
        fileSize: data.file_size,
        storagePath: data.storage_path,
        uploadedAt: new Date(data.uploaded_at),
        isGlobal: data.is_global,
      };

      setStandards((prev) => [newStandard, ...prev]);
      toast.success(`Uploaded: ${file.name}`);
      return newStandard;
    } catch (error) {
      console.error('Error uploading standard:', error);
      toast.error(`Failed to upload: ${file.name}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Upload multiple files
  const uploadStandards = async (files: File[]): Promise<void> => {
    for (const file of files) {
      await uploadStandard(file);
    }
  };

  // Delete a standard
  const deleteStandard = async (id: string): Promise<boolean> => {
    if (!user) {
      toast.error('You must be logged in to delete standards');
      return false;
    }

    try {
      // Find the standard to get storage path
      const standard = standards.find((s) => s.id === id);
      
      if (standard?.storagePath) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('standards')
          .remove([standard.storagePath]);

        if (storageError) {
          console.warn('Storage deletion error:', storageError);
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('standards_library')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      setStandards((prev) => prev.filter((s) => s.id !== id));
      toast.success('Standard deleted');
      return true;
    } catch (error) {
      console.error('Error deleting standard:', error);
      toast.error('Failed to delete standard');
      return false;
    }
  };

  return {
    standards,
    isLoading,
    isUploading,
    uploadStandard,
    uploadStandards,
    deleteStandard,
    refetch: fetchStandards,
  };
}
