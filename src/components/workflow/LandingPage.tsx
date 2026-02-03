import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderPlus, History, Zap } from 'lucide-react';
import arialLogo from '@/assets/arial-logo.png';
interface LandingPageProps {
  onCreateNew: () => void;
  onViewHistory: () => void;
  hasProjects: boolean;
}
const LandingPage: React.FC<LandingPageProps> = ({
  onCreateNew,
  onViewHistory,
  hasProjects
}) => {
  return <div className="min-h-full bg-background engineering-grid flex items-center justify-center py-12">
      <div className="max-w-3xl mx-auto px-6 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-2">
            
          </div>
          <h1 className="text-4xl font-bold text-foreground">Welcome to ARIAL</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            AI-powered PV design review and compliance verification platform for Saudi Arabia projects
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Create New Project Card */}
          <Card className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 animate-slide-up" onClick={onCreateNew}>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <FolderPlus className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Create New Project</CardTitle>
              <CardDescription>
                Start a new PV design review with file upload and compliance analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full gap-2" size="lg">
                <Zap className="w-4 h-4" />
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* View History Card */}
          <Card className={`group cursor-pointer transition-all hover:shadow-lg animate-slide-up ${hasProjects ? 'hover:border-primary/50' : 'opacity-60'}`} style={{
          animationDelay: '100ms'
        }} onClick={hasProjects ? onViewHistory : undefined}>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-3 group-hover:bg-secondary transition-colors">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl">Project History</CardTitle>
              <CardDescription>
                {hasProjects ? 'View and manage your previous design review projects' : 'No previous projects yet. Create your first project to get started.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="secondary" className="w-full gap-2" size="lg" disabled={!hasProjects}>
                <History className="w-4 h-4" />
                {hasProjects ? 'View History' : 'No Projects Yet'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features List */}
        <div className="text-center pt-6">
          <p className="text-sm text-muted-foreground">
            Powered by GPT-5.2 • SEC, IEC, SASO Standards • Automated Compliance Verification
          </p>
        </div>
      </div>
    </div>;
};
export default LandingPage;