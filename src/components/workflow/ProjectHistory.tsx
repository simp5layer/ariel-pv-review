import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Project } from '@/types/project';
import { format } from 'date-fns';

interface ProjectHistoryProps {
  projects: Project[];
  onBack: () => void;
  onSelectProject: (project: Project) => void;
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

const ProjectHistory: React.FC<ProjectHistoryProps> = ({ projects, onBack, onSelectProject }) => {
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
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Project →
                  </Button>
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
    </div>
  );
};

export default ProjectHistory;
