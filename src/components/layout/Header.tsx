import React from 'react';
import { Home, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import arialLogo from '@/assets/arial-logo.png';
import desertTechLogo from '@/assets/desert-technologies-logo.png';

const Header: React.FC = () => {
  const { viewMode, setViewMode, setCurrentProject, setCurrentStep } = useProject();
  const { user, signOut } = useAuth();

  const handleGoHome = () => {
    setCurrentProject(null);
    setCurrentStep(0);
    setViewMode('landing');
  };

  const showHomeButton = viewMode !== 'landing';

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

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
        <span className="text-sm text-white/80 hidden sm:block">Powered by</span>
        <img 
          src={desertTechLogo} 
          alt="Desert Technologies" 
          className="h-12 object-contain" 
        />
        
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{userName}</span>
                <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;