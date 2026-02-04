import React from 'react';
import { Check, FolderPlus, Search, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/ProjectContext';

const steps = [
  { id: 0, label: 'Project Setup', icon: FolderPlus },
  { id: 1, label: 'Analyze & Extract', icon: Search },
  { id: 2, label: 'Design Review', icon: ClipboardCheck },
];

const WorkflowStepper: React.FC = () => {
  const { currentStep, setCurrentStep, currentProject } = useProject();

  const canNavigateToStep = (stepId: number) => {
    if (!currentProject && stepId > 0) return false;
    return stepId <= currentStep;
  };

  return (
    <div className="bg-card border-b border-border px-6 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Progress line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
          <div 
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const isClickable = canNavigateToStep(step.id);

            return (
              <button
                key={step.id}
                onClick={() => isClickable && setCurrentStep(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex flex-col items-center gap-2 relative z-10 transition-all duration-200",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                    !isCompleted && !isCurrent && "bg-card border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium transition-colors duration-200",
                    isCurrent && "text-primary",
                    isCompleted && "text-foreground",
                    !isCompleted && !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowStepper;
