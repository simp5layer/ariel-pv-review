import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-primary/5 border-primary/20',
  success: 'bg-pass/10 border-pass/20',
  warning: 'bg-major/10 border-major/20',
  danger: 'bg-critical/10 border-critical/20'
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-pass/20 text-pass',
  warning: 'bg-major/20 text-major',
  danger: 'bg-critical/20 text-critical'
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default'
}) => {
  return (
    <div className={cn(
      "rounded-xl border p-5 transition-all duration-200 hover:shadow-md",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            iconVariantStyles[variant]
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
