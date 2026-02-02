import React, { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import FileUploadZone from '@/components/ui/FileUploadZone';
import { Project, SystemType, UploadedFile } from '@/types/project';
import { FolderPlus, MapPin, Zap, ArrowRight } from 'lucide-react';

const systemTypes: { value: SystemType; label: string; description: string }[] = [
  { value: 'standalone', label: 'Standalone', description: 'Off-grid system with battery storage' },
  { value: 'on-grid', label: 'On-Grid', description: 'Grid-connected system without batteries' },
  { value: 'hybrid', label: 'Hybrid', description: 'Grid-connected with battery backup' }
];

const ProjectSetup: React.FC = () => {
  const { setCurrentProject, setCurrentStep } = useProject();
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [systemType, setSystemType] = useState<SystemType>('on-grid');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleFilesAdded = (files: UploadedFile[]) => {
    setUploadedFiles([...uploadedFiles, ...files]);
  };

  const handleFileRemove = (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== fileId));
  };

  const handleCreateProject = () => {
    if (!projectName.trim() || !location.trim()) return;

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: projectName,
      location,
      systemType,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'setup',
      files: uploadedFiles,
      standardFiles: []
    };

    setCurrentProject(newProject);
    setCurrentStep(1);
  };

  const isValid = projectName.trim() && location.trim() && uploadedFiles.length > 0;

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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Riyadh, Saudi Arabia"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
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
              >
                {systemTypes.map((type) => (
                  <Label
                    key={type.value}
                    htmlFor={type.value}
                    className={`flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                      ${systemType === type.value 
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                        : 'border-border hover:border-primary/50'}`}
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
                Upload DWG drawings, PDF reports, Excel calculations, and datasheets for analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                onFilesAdded={handleFilesAdded}
                existingFiles={uploadedFiles}
                onFileRemove={handleFileRemove}
                label="Drop your design files here"
                description="Supports DWG, DXF, PDF, XLSX, XLS, CSV"
              />
            </CardContent>
          </Card>

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              onClick={handleCreateProject}
              disabled={!isValid}
              className="gap-2"
            >
              Create Project & Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSetup;
