import React, { useState, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectManagement } from '@/hooks/useProjectManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { SystemType } from '@/types/project';
import { FolderPlus, MapPin, Zap, ArrowRight, Upload, File, X, FileText, Table, Image, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const systemTypes: { value: SystemType; label: string; description: string }[] = [
  { value: 'standalone', label: 'Standalone', description: 'Off-grid system with battery storage' },
  { value: 'on-grid', label: 'On-Grid', description: 'Grid-connected system without batteries' },
  { value: 'hybrid', label: 'Hybrid', description: 'Grid-connected with battery backup' }
];

const fileTypeIcons: Record<string, React.ElementType> = {
  dwg: Image,
  dxf: Image,
  pdf: FileText,
  xlsx: Table,
  xls: Table,
  csv: Table,
  doc: FileText,
  docx: FileText
};

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return fileTypeIcons[ext] || File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ProjectSetup: React.FC = () => {
  const { setCurrentProject, setCurrentStep, addToHistory } = useProject();
  const { createProject, isCreating, uploadProgress } = useProjectManagement();
  
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [systemType, setSystemType] = useState<SystemType>('on-grid');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (fileList: FileList) => {
    const newFiles = Array.from(fileList);
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    if (!location.trim()) {
      toast.error('Please enter a location');
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    try {
      const project = await createProject({
        name: projectName,
        location,
        systemType,
        files: selectedFiles
      });

      if (project) {
        setCurrentProject(project);
        addToHistory(project);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error('Create project error:', error);
      toast.error('Failed to create project. Please try again.');
    }
  };

  const isValid = projectName.trim() && location.trim() && selectedFiles.length > 0;

  return (
    <div className="min-h-full bg-background engineering-grid py-8">
      <div className="max-w-4xl mx-auto px-6 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-2">
            <FolderPlus className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Create New Project</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Set up your PV design review project by providing basic information and uploading your design files.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Project Details Card */}
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Project Details
              </CardTitle>
              <CardDescription>
                Enter the basic information about your PV installation project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name *</Label>
                  <Input
                    id="projectName"
                    placeholder="e.g., NEOM Solar Farm Phase 1"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Riyadh, Saudi Arabia"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Classification Card */}
          <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                System Classification
              </CardTitle>
              <CardDescription>
                Select the type of PV system being designed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={systemType}
                onValueChange={(value) => setSystemType(value as SystemType)}
                className="grid gap-3 sm:grid-cols-3"
                disabled={isCreating}
              >
                {systemTypes.map((type) => (
                  <Label
                    key={type.value}
                    htmlFor={type.value}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all",
                      systemType === type.value 
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                        : 'border-border hover:border-primary/50',
                      isCreating && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={type.value} id={type.value} />
                      <span className="font-medium">{type.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground pl-6">
                      {type.description}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* File Upload Card */}
          <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle>Upload Design Files</CardTitle>
              <CardDescription>
                Upload DWG drawings, PDF reports, Excel calculations, Word documents, and datasheets for GPT-5.2 analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                  isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                  isCreating && "opacity-50 pointer-events-none"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".dwg,.dxf,.pdf,.xlsx,.xls,.csv,.doc,.docx"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isCreating}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                    isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground">Drop your design files here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supports: DWG, DXF, PDF, XLSX, XLS, CSV, DOC, DOCX
                    </p>
                  </div>
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Selected Files ({selectedFiles.length})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedFiles.map((file, index) => {
                      const Icon = getFileIcon(file.name);
                      return (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          {!isCreating && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveFile(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isCreating && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading files...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              onClick={handleCreateProject}
              disabled={!isValid || isCreating}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  Create Project & Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSetup;
