import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Deliverable, DeliverableType, DELIVERABLE_METADATA } from '@/types/project';
import { 
  CheckCircle, 
  Circle, 
  RefreshCw, 
  Download, 
  Package,
  Clock,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface DeliverablesPanelProps {
  deliverables: Deliverable[];
  onGenerateMissing: () => void;
  onRegenerateAll: () => void;
  onExportPackage: () => void;
  isGenerating?: boolean;
  submissionNumber?: number;
}

const deliverableOrder: DeliverableType[] = [
  'ai_prompt_log',
  'design_review_report',
  'issue_register',
  'compliance_checklist',
  'recalculation_sheet',
  'redline_notes',
  'bom_boq',
  'risk_reflection'
];

const DeliverablesPanel: React.FC<DeliverablesPanelProps> = ({
  deliverables,
  onGenerateMissing,
  onRegenerateAll,
  onExportPackage,
  isGenerating = false,
  submissionNumber
}) => {
  const getDeliverableStatus = (type: DeliverableType): Deliverable | undefined => {
    return deliverables.find(d => d.type === type);
  };

  const generatedCount = deliverables.filter(d => d.status !== 'not_generated').length;
  const totalCount = deliverableOrder.length;
  const progressPercent = Math.round((generatedCount / totalCount) * 100);
  const allGenerated = generatedCount === totalCount;
  const hasMissing = generatedCount < totalCount;

  const getStatusIcon = (status?: Deliverable['status']) => {
    switch (status) {
      case 'generated':
        return <CheckCircle className="w-4 h-4 text-pass" />;
      case 'updated':
        return <RefreshCw className="w-4 h-4 text-primary" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: Deliverable['status']) => {
    switch (status) {
      case 'generated':
        return <Badge variant="outline" className="bg-pass/10 text-pass border-pass/20">Generated</Badge>;
      case 'updated':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Updated</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Not Generated</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Deliverables Checklist
          </CardTitle>
          {submissionNumber && (
            <Badge variant="secondary">Submission #{submissionNumber}</Badge>
          )}
        </div>
        <div className="space-y-2 mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {generatedCount} of {totalCount} deliverables ready
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deliverables List */}
        <div className="space-y-2">
          {deliverableOrder.map((type) => {
            const deliverable = getDeliverableStatus(type);
            const metadata = DELIVERABLE_METADATA[type];
            
            return (
              <TooltipProvider key={type}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors
                        ${deliverable?.status === 'generated' || deliverable?.status === 'updated'
                          ? 'bg-pass/5 border-pass/20'
                          : 'bg-muted/30 border-border hover:border-primary/30'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{metadata.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{metadata.name}</p>
                          {deliverable?.generatedAt && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(deliverable.generatedAt, 'PPp')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(deliverable?.status)}
                        {getStatusIcon(deliverable?.status)}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p>{metadata.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Completion Warning */}
        {!allGenerated && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">Incomplete Deliverables</p>
              <p className="text-xs text-muted-foreground">
                All 8 deliverables must be generated before marking the review as complete.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {hasMissing && (
            <Button 
              onClick={onGenerateMissing}
              disabled={isGenerating}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Missing Deliverables
                </>
              )}
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={onRegenerateAll}
              disabled={isGenerating || generatedCount === 0}
              className="flex-1 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate All
            </Button>
            <Button 
              variant="outline"
              onClick={onExportPackage}
              disabled={!allGenerated}
              className="flex-1 gap-2"
            >
              <Download className="w-4 h-4" />
              Export Package
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliverablesPanel;
