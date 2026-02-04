import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, UploadedFile, SystemType } from '@/types/project';
import { toast } from 'sonner';

interface CreateProjectData {
  name: string;
  location: string;
  systemType: SystemType;
  files: File[];
}

export function useProjectManagement() {
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const createProject = async (data: CreateProjectData): Promise<Project | null> => {
    setIsCreating(true);
    setUploadProgress(0);

    try {
      // Get current user
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('Not authenticated');
      }

      const userId = sessionData.session.user.id;

      // Step 1: Create project in database
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: data.name,
          location: data.location,
          system_type: data.systemType,
          user_id: userId,
          status: 'setup'
        })
        .select()
        .single();

      if (projectError) {
        console.error('Project creation error:', projectError);
        throw new Error(`Failed to create project: ${projectError.message}`);
      }

      setUploadProgress(20);

      // Step 2: Upload files to storage and create file records
      const uploadedFiles: UploadedFile[] = [];
      const totalFiles = data.files.length;

      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i];
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        
        // Determine file type
        let fileType: 'dwg' | 'pdf' | 'excel' | 'datasheet' = 'datasheet';
        if (fileExt === 'dwg' || fileExt === 'dxf') fileType = 'dwg';
        else if (fileExt === 'pdf') fileType = 'pdf';
        else if (['xlsx', 'xls', 'csv'].includes(fileExt)) fileType = 'excel';

        // Sanitize filename
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${userId}/${projectData.id}/${Date.now()}-${sanitizedName}`;

        try {
          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('project-files')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('File upload error:', uploadError);
            toast.error(`Failed to upload ${file.name}`);
            continue;
          }

          // Create file record in database
          const { data: fileRecord, error: fileError } = await supabase
            .from('project_files')
            .insert({
              project_id: projectData.id,
              name: file.name,
              file_type: fileType,
              size: file.size,
              storage_path: storagePath,
              status: 'completed'
            })
            .select()
            .single();

          if (fileError) {
            console.error('File record error:', fileError);
            continue;
          }

          uploadedFiles.push({
            id: fileRecord.id,
            name: file.name,
            type: fileType,
            size: file.size,
            uploadedAt: new Date(fileRecord.uploaded_at),
            status: 'completed',
            storagePath
          });

        } catch (err) {
          console.error('File processing error:', err);
          toast.error(`Error processing ${file.name}`);
        }

        // Update progress
        setUploadProgress(20 + Math.round((i + 1) / totalFiles * 70));
      }

      setUploadProgress(100);

      // Build the project object
      const project: Project = {
        id: projectData.id,
        name: projectData.name,
        location: projectData.location,
        systemType: projectData.system_type as SystemType,
        createdAt: new Date(projectData.created_at),
        updatedAt: new Date(projectData.updated_at),
        status: projectData.status as Project['status'],
        files: uploadedFiles,
        standardFiles: []
      };

      toast.success('Project created successfully');
      return project;

    } catch (error) {
      console.error('Create project error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const loadUserProjects = async (): Promise<Project[]> => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          project_files (*)
        `)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Load projects error:', projectsError);
        throw projectsError;
      }

      return (projectsData || []).map(p => ({
        id: p.id,
        name: p.name,
        location: p.location,
        systemType: p.system_type as SystemType,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at),
        status: p.status as Project['status'],
        files: (p.project_files || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.file_type,
          size: f.size,
          uploadedAt: new Date(f.uploaded_at),
          status: f.status,
          storagePath: f.storage_path
        })),
        standardFiles: []
      }));
    } catch (error) {
      console.error('Load projects error:', error);
      return [];
    }
  };

  const deleteProject = async (projectId: string): Promise<boolean> => {
    try {
      // Get project files first
      const { data: files } = await supabase
        .from('project_files')
        .select('storage_path')
        .eq('project_id', projectId);

      // Delete files from storage
      if (files && files.length > 0) {
        const paths = files.map(f => f.storage_path).filter(Boolean) as string[];
        if (paths.length > 0) {
          await supabase.storage.from('project-files').remove(paths);
        }
      }

      // Delete project (cascades to project_files)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast.success('Project deleted');
      return true;
    } catch (error) {
      console.error('Delete project error:', error);
      toast.error('Failed to delete project');
      return false;
    }
  };

  const updateProject = async (projectId: string, updates: { name?: string; location?: string }): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      toast.success('Project updated');
      return true;
    } catch (error) {
      console.error('Update project error:', error);
      toast.error('Failed to update project');
      return false;
    }
  };

  return {
    createProject,
    loadUserProjects,
    deleteProject,
    updateProject,
    isCreating,
    uploadProgress
  };
}
