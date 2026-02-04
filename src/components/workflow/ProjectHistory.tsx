import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, FileText, Clock, Trash2, Pencil } from 'lucide-react';
import { Project } from '@/types/project';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProjectHistoryProps {
  projects: Project[];
  onBack: () => void;
  onSelectProject: (project: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  onUpdateProject?: (project: Project) => void;
}

const getStatusBadge = (status: Project['status']) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-severity-pass/10 text-severity-pass border-severity-pass/20">Completed</Badge>;
    case 'reviewing':
      return <Badge className="bg-primary/10 text-primary border-primary/20">In Review</Badge>;
    case 'standards':
      return <Badge className="bg-severity-minor/10 text-severity-minor border-severity-minor/20">Standards</Badge>;
    case 'analyzing':
      return <Badge className="bg-severity-major/10 text-severity-major border-severity-major/20">Analyzing</Badge>;
    default:
      return <Badge variant="secondary">Setup</Badge>;
  }
};

const getSystemTypeBadge = (type: Project['systemType']) => {
  const labels = {
    'standalone': 'Standalone',
    'on-grid': 'On-Grid',
    'hybrid': 'Hybrid'
  };
  return <Badge variant="outline">{labels[type]}</Badge>;
};

const ProjectHistory: React.FC<ProjectHistoryProps> = ({ 
  projects, 
  onBack, 
  onSelectProject,
  onDeleteProject,
  onUpdateProject 
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSelectedProject(project);
    setEditName(project.name);
    setEditLocation(project.location);
    setEditDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProject) return;
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', selectedProject.id);
      
      if (error) throw error;
      
      toast.success('Project deleted successfully');
      onDeleteProject?.(selectedProject.id);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete project');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    }
  };

  const confirmEdit = async () => {
    if (!selectedProject) return;
    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: editName, location: editLocation })
        .eq('id', selectedProject.id);
      
      if (error) throw error;
      
      toast.success('Project updated successfully');
      onUpdateProject?.({
        ...selectedProject,
        name: editName,
        location: editLocation
      });
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update project');
    } finally {
      setIsUpdating(false);
      setEditDialogOpen(false);
      setSelectedProject(null);
    }
  };

  return (
    <div className="min-h-full bg-background engineering-grid py-8">
      <div className="max-w-4xl mx-auto px-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Project History</h1>
            <p className="text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? 's' : ''} reviewed
            </p>
          </div>
        </div>

        {/* Projects List */}
        <div className="space-y-4">
          {projects.map((project, index) => (
            <Card 
              key={project.id}
              className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => onSelectProject(project)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {project.location}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSystemTypeBadge(project.systemType)}
                    {getStatusBadge(project.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(project.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={(e) => handleEditClick(e, project)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteClick(e, project)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Project →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {projects.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-4">
                Your completed projects will appear here
              </p>
              <Button onClick={onBack}>Create Your First Project</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone and will remove all associated files and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project name and location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Enter location"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={confirmEdit} disabled={isUpdating || !editName.trim()}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectHistory;
