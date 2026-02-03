import React from 'react';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '@/contexts/ProjectContext';
import arialLogo from '@/assets/arial-logo.png';
import desertTechLogo from '@/assets/desert-technologies-logo.png';

const Header: React.FC = () => {
  const { viewMode, setViewMode, setCurrentProject, setCurrentStep } = useProject();

  const handleGoHome = () => {
    setCurrentProject(null);
    setCurrentStep(0);
    setViewMode('landing');
  };

  const showHomeButton = viewMode !== 'landing';

  return (
    <header className="h-20 bg-gradient-to-r from-secondary to-primary px-6 flex items-center justify-between">
      <div className="flex items-center gap-6">
        {showHomeButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoHome}
            className="text-white hover:bg-white/20"
          >
            <Home className="h-5 w-5" />
          </Button>
        )}
        <img 
          src={arialLogo} 
          alt="ARIAL - Assessment of Renewable Infrastructure Analysis and Linkage" 
          className="h-14 object-contain rounded-lg" 
        />
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-sm text-white/80">Powered by</span>
        <img 
          src={desertTechLogo} 
          alt="Desert Technologies" 
          className="h-12 object-contain" 
        />
      </div>
    </header>
  );
};

export default Header;