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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Storage object keys can be picky (unicode/commas/etc). Keep DB file_name as-is,
 * but sanitize the storage path segment so uploads don't fail with InvalidKey.
 */
const sanitizeStorageFilename = (originalName: string) => {
  const ext = originalName.split('.').pop()?.toLowerCase();
  const base = originalName.replace(/\.[^/.]+$/, '');

  // Normalize, strip diacritics, replace non-safe chars.
  const safeBase = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120);

  const finalBase = safeBase || 'standard';
  return ext ? `${finalBase}.${ext}` : finalBase;
};

async function uploadToStandardsBucket(params: {
  objectPath: string;
  file: File;
  accessToken: string;
}): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/standards/${params.objectPath}`;
  const formData = new FormData();
  formData.append('cacheControl', '3600');
  // Supabase storage accepts a file with an empty field name in browser form uploads.
  formData.append('', params.file);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${params.accessToken}`,
      'x-upsert': 'false',
    },
    body: formData,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const json = await res.json();
      message = json?.message || json?.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

async function deleteFromStandardsBucket(params: {
  objectPath: string;
  accessToken: string;
}): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/standards/${params.objectPath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  // DELETE is idempotent; treat 404 as success.
  if (!res.ok && res.status !== 404) {
    let message = `Delete failed (${res.status})`;
    try {
      const json = await res.json();
      message = json?.message || json?.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

export function useStandardsLibrary() {
  const { user, session } = useAuth();
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
    if (!user || !session?.access_token) {
      toast.error('You must be logged in to upload standards');
      return null;
    }

    setIsUploading(true);

    try {
      // Enforce the platform limit early to avoid long hangs.
      const maxBytes = 20 * 1024 * 1024;
      if (file.size > maxBytes) {
        toast.error(`File too large (max 20MB): ${file.name}`);
        return null;
      }

      // Create unique storage path
      const safeName = sanitizeStorageFilename(file.name);
      const objectPath = `${user.id}/${Date.now()}-${safeName}`;

      // Upload to storage bucket (REST with explicit access token to avoid anon uploads)
      await uploadToStandardsBucket({
        objectPath,
        file,
        accessToken: session.access_token,
      });

      // Create database record
      const { data, error: dbError } = await supabase
        .from('standards_library')
        .insert({
          user_id: user.id,
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for name
          file_name: file.name,
          file_size: file.size,
          storage_path: objectPath,
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
    // Sequential + small yield keeps UI responsive and reduces request bursts.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // simple retry once (handles transient network/auth refresh timing)
      const first = await uploadStandard(file);
      if (!first) {
        await sleep(250);
        await uploadStandard(file);
      }

      await sleep(50);
    }
  };

  // Delete a standard
  const deleteStandard = async (id: string): Promise<boolean> => {
    if (!user || !session?.access_token) {
      toast.error('You must be logged in to delete standards');
      return false;
    }

    try {
      // Find the standard to get storage path
      const standard = standards.find((s) => s.id === id);
      
      if (standard?.storagePath) {
        try {
          await deleteFromStandardsBucket({
            objectPath: standard.storagePath,
            accessToken: session.access_token,
          });
        } catch (storageError) {
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
