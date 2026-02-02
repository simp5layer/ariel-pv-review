import React from 'react';
import { cn } from '@/lib/utils';
import { SeverityLevel } from '@/types/project';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const severityConfig: Record<SeverityLevel, { 
  label: string; 
  code: string;
  icon: React.ElementType;
  className: string;
}> = {
  critical: { 
    label: 'Critical', 
    code: 'P0',
    icon: AlertTriangle,
    className: 'bg-critical text-critical-foreground'
  },
  major: { 
    label: 'Major', 
    code: 'P1',
    icon: AlertCircle,
    className: 'bg-major text-major-foreground'
  },
  minor: { 
    label: 'Minor', 
    code: 'P2',
    icon: Info,
    className: 'bg-minor text-minor-foreground'
  },
  pass: { 
    label: 'Pass', 
    code: 'OK',
    icon: CheckCircle,
    className: 'bg-pass text-pass-foreground'
  }
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
  lg: 'px-3 py-1.5 text-base gap-2'
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5'
};

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ 
  severity, 
  showLabel = true,
  size = 'md'
}) => {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.className,
        sizeClasses[size]
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
      <span className="opacity-75">({config.code})</span>
    </span>
  );
};

export default SeverityBadge;
