import React from 'react';
import arialLogo from '@/assets/arial-logo.png';
import desertTechLogo from '@/assets/desert-technologies-logo.png';

const Header: React.FC = () => {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <img 
          src={arialLogo} 
          alt="ARIAL - Assessment of Renewable Infrastructure Analysis and Linkage" 
          className="h-10 object-contain"
        />
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Powered by</span>
        <img 
          src={desertTechLogo} 
          alt="Desert Technologies" 
          className="h-8 object-contain"
        />
      </div>
    </header>
  );
};

export default Header;
