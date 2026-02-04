import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SeverityBadge from '@/components/ui/SeverityBadge';
import StatCard from '@/components/ui/StatCard';
import DeliverablesPanel from './DeliverablesPanel';
import DeliverablesViewer from './DeliverablesViewer';
import TraceabilityPanel from './TraceabilityPanel';
import { Deliverable, DeliverableType, DELIVERABLE_METADATA } from '@/types/project';
import { useDeliverables } from '@/hooks/useDeliverables';
import {
  ClipboardCheck,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  User,
  TrendingUp,
  Lightbulb,
  FileCheck,
  Package,
  FileText,
  Calculator
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

const DesignReview: React.FC = () => {
  const {
    setCurrentStep,
    findings,
    submissions,
    isReviewing,
    currentProject,
    extractedData,
    runComplianceReview
  } = useProject();

  const { generateMissingDeliverables, fetchDeliverables, isGenerating, progress: genProgress } = useDeliverables();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Fetch deliverables when submissions change
  const latestSubmission = submissions[submissions.length - 1];
  
  useEffect(() => {
    if (latestSubmission?.id && latestSubmission.id !== submissionId) {
      setSubmissionId(latestSubmission.id);
      fetchDeliverables(latestSubmission.id).then(setDeliverables);
    }
  }, [latestSubmission?.id, submissionId, fetchDeliverables]);

  // Auto-refresh deliverables for a short period after a new submission appears.
  // This supports the new backend chaining (compliance -> deliverables) where deliverables
  // may complete a few seconds after the compliance job finishes.
  useEffect(() => {
    if (!submissionId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~2 minutes (40 * 3s)
    const intervalMs = 3000;

    const tick = async () => {
      attempts++;
      const updated = await fetchDeliverables(submissionId);
      if (cancelled) return;
      setDeliverables(updated);

      const got = new Set(updated.map(d => d.type));
      const done = deliverableOrder.every(t => got.has(t));
      if (done || attempts >= maxAttempts) {
        clearInterval(handle);
      }
    };

    const handle = setInterval(tick, intervalMs);
    // immediate refresh once
    tick();

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [submissionId, fetchDeliverables]);

  // Build deliverables list from persisted records only (avoid "computed" statuses)
  // so the checklist reflects what was actually generated and stored.
  const displayDeliverables: Deliverable[] = useMemo(() => {
    const fetchedMap = new Map(deliverables.map(d => [d.type, d]));

    return deliverableOrder.map((type) => {
      const fetched = fetchedMap.get(type);
      return fetched ?? {
        id: `placeholder-${type}`,
        type,
        name: DELIVERABLE_METADATA[type].name,
        status: 'not_generated',
        submissionNumber: submissions.length || undefined,
      };
    });
  }, [submissions.length, deliverables]);

  const handleRunReview = async () => {
    // Build project file content from extracted data for AI analysis
    const projectFiles: { name: string; content: string }[] = [];
    
    // Add extracted data as structured content
    if (extractedData) {
      projectFiles.push({
        name: 'extracted_data.json',
        content: JSON.stringify(extractedData, null, 2)
      });
    }
    
    // Add file list as context
    if (currentProject?.files && currentProject.files.length > 0) {
      const fileList = currentProject.files.map(f => `- ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)} KB)`).join('\n');
      projectFiles.push({
        name: 'project_files_list.txt',
        content: `Project Files:\n${fileList}\n\nProject: ${currentProject.name}\nLocation: ${currentProject.location}\nSystem Type: ${currentProject.systemType}`
      });
    }
    
    // If we have no files, add placeholder
    if (projectFiles.length === 0) {
      projectFiles.push({
        name: 'project_summary.txt',
        content: `Project: ${currentProject?.name || 'Unknown'}\nLocation: ${currentProject?.location || 'Unknown'}\nNo extracted data available yet.`
      });
    }

    try {
      await runComplianceReview(projectFiles);
      toast.success('Design review completed');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Design review failed';
      toast.error(msg);
    }
  };

  const handleGenerateMissing = useCallback(async () => {
    if (!currentProject) {
      toast.error('No project selected');
      return;
    }
    
    try {
      const result = await generateMissingDeliverables(
        currentProject.id,
        findings,
        extractedData,
        submissionId || undefined
      );

      // Use submission id returned from result, or fallback to current
      const finalSubId = (result as any)?.submissionId || submissionId;
      if (finalSubId) {
        setSubmissionId(finalSubId);
        // Refresh deliverables
        const updated = await fetchDeliverables(finalSubId);
        setDeliverables(updated);
      }
    } catch (err) {
      console.error('handleGenerateMissing error', err);
    }
  }, [currentProject, findings, extractedData, submissionId, generateMissingDeliverables, fetchDeliverables]);

  const handleRegenerateAll = useCallback(() => {
    toast.info('Regeneration will be available soon.');
  }, []);

  const handleExportPackage = useCallback(() => {
    toast.info('Export package will be available soon.');
  }, []);

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const majorCount = findings.filter(f => f.severity === 'major').length;
  const minorCount = findings.filter(f => f.severity === 'minor').length;
  const passCount = findings.filter(f => f.severity === 'pass').length;
  const totalFindings = findings.length;
  
  // ITRFFE-style compliance calculation:
  // Critical (P0) = 15 points each, Major (P1) = 8 points each, Minor (P2) = 3 points each
  // Max score = 100, deduct weighted issue points
  const issueCount = criticalCount + majorCount + minorCount;
  const weightedDeduction = (criticalCount * 15) + (majorCount * 8) + (minorCount * 3);
  const compliancePercentage = totalFindings > 0 
    ? Math.max(0, Math.min(100, 100 - weightedDeduction))
    : 100; // 100% if no findings

  // latestSubmission already computed above

  return (
    <div className="min-h-full bg-background py-8">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Design Review Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive compliance verification against applicable standards
            </p>
          </div>
          {findings.length === 0 && (
            <Button
              onClick={handleRunReview}
              disabled={isReviewing}
              size="lg"
              className="gap-2"
            >
              {isReviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Review...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  Run Design Review
                </>
              )}
            </Button>
          )}
        </div>

        {/* Review Progress */}
        {isReviewing && (
          <Card className="animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <div>
                  <h3 className="font-semibold">AI-Powered Design Review in Progress</h3>
                  <p className="text-sm text-muted-foreground">
                    Analyzing design against SEC, IEC, and SASO standards...
                  </p>
                </div>
              </div>
              <Progress value={45} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Results Dashboard with Deliverables Sidebar */}
        {findings.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Main Content */}
            <div className="space-y-6">
              <Tabs defaultValue="findings" className="space-y-6">
               <TabsList>
                  <TabsTrigger value="findings" className="gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Compliance Findings
                  </TabsTrigger>
                   <TabsTrigger value="deliverables" className="gap-2">
                     <FileText className="w-4 h-4" />
                     Deliverables
                   </TabsTrigger>
                  <TabsTrigger value="bom" className="gap-2">
                    <Package className="w-4 h-4" />
                    BoM & BoQ
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="gap-2">
                    <Clock className="w-4 h-4" />
                    Submission Timeline
                  </TabsTrigger>
                  <TabsTrigger value="advantages" className="gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Advantages
                  </TabsTrigger>
                </TabsList>

            <TabsContent value="findings" className="space-y-6">
              {/* Compliance Stats */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  title="Compliance Score"
                  value={`${compliancePercentage}%`}
                  icon={FileCheck}
                  variant={compliancePercentage >= 80 ? 'success' : compliancePercentage >= 50 ? 'warning' : 'danger'}
                />
                <StatCard
                  title="Critical (P0)"
                  value={criticalCount}
                  icon={AlertTriangle}
                  variant="danger"
                />
                <StatCard
                  title="Major (P1)"
                  value={majorCount}
                  icon={AlertCircle}
                  variant="warning"
                />
                <StatCard
                  title="Minor (P2)"
                  value={minorCount}
                  icon={Info}
                  variant="default"
                />
                <StatCard
                  title="Passed"
                  value={passCount}
                  icon={CheckCircle}
                  variant="success"
                />
              </div>

              {/* Findings Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Non-Conformities & Findings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[120px]">Issue ID</TableHead>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[180px]">Location</TableHead>
                          <TableHead className="w-[120px]">Severity</TableHead>
                          <TableHead className="w-[250px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {findings.map((finding) => (
                          <TableRow 
                            key={finding.id}
                            className="hover:bg-muted/30"
                          >
                            <TableCell className="font-mono font-medium">
                              {finding.issueId}
                            </TableCell>
                            <TableCell className="font-medium">
                              {finding.name}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="text-sm">{finding.description}</p>
                                <p className="text-xs text-muted-foreground font-mono bg-muted/50 p-1.5 rounded">
                                  📖 {finding.standardReference}
                                </p>
                                {finding.evidencePointer && (
                                  <p className="text-xs text-muted-foreground font-mono bg-muted/50 p-1.5 rounded">
                                    🔎 {finding.evidencePointer}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {finding.location}
                            </TableCell>
                            <TableCell>
                              <SeverityBadge severity={finding.severity} size="sm" />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  finding.actionType === 'corrective' 
                                    ? 'bg-destructive/10 text-destructive' 
                                    : 'bg-secondary/10 text-secondary'
                                }`}>
                                  {finding.actionType === 'corrective' ? 'Corrective Action' : 'Recommendation'}
                                </span>
                                <p className="text-sm">{finding.action}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deliverables" className="space-y-6">
              <DeliverablesViewer
                deliverables={displayDeliverables}
                onGenerateMissing={handleGenerateMissing}
                isGenerating={isGenerating}
              />
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Submission History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {submissions.length > 0 ? (
                    <div className="space-y-4">
                      {submissions.map((submission, index) => (
                        <div
                          key={submission.id}
                          className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            submission.status === 'passed' 
                              ? 'bg-pass/20 text-pass' 
                              : 'bg-critical/20 text-critical'
                          }`}>
                            {submission.status === 'passed' 
                              ? <CheckCircle className="w-5 h-5" />
                              : <AlertTriangle className="w-5 h-5" />
                            }
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold">
                                Submission #{index + 1}
                              </h4>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                submission.status === 'passed'
                                  ? 'bg-pass/10 text-pass'
                                  : 'bg-critical/10 text-critical'
                              }`}>
                                {submission.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="mt-2 grid gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>{submission.submittedBy}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>
                                  Submitted: {format(submission.submittedAt, 'PPpp')}
                                </span>
                              </div>
                              {submission.completedAt && (
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  <span>
                                    Completed: {format(submission.completedAt, 'PPpp')}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                <span>Compliance: {submission.compliancePercentage}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No submissions yet. Run a design review to create the first submission.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advantages" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-warning" />
                    Optimization Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 bg-accent/30 rounded-lg border border-accent-foreground/10">
                      <h4 className="font-semibold flex items-center gap-2">
                        🚶 Walkway Design Review
                      </h4>
                      <p className="text-sm text-muted-foreground mt-2">
                        Analysis of maintenance access paths and safety clearances around module arrays.
                      </p>
                    </div>
                    <div className="p-4 bg-accent/30 rounded-lg border border-accent-foreground/10">
                      <h4 className="font-semibold flex items-center gap-2">
                        🧹 Dust & Cleaning System
                      </h4>
                      <p className="text-sm text-muted-foreground mt-2">
                        Recommendations for automated cleaning systems based on Saudi Arabia climate conditions.
                      </p>
                    </div>
                    <div className="p-4 bg-accent/30 rounded-lg border border-accent-foreground/10">
                      <h4 className="font-semibold flex items-center gap-2">
                        📉 Loss Reduction Strategies
                      </h4>
                      <p className="text-sm text-muted-foreground mt-2">
                        Identified opportunities to minimize soiling, thermal, and cable losses.
                      </p>
                    </div>
                    <div className="p-4 bg-accent/30 rounded-lg border border-accent-foreground/10">
                      <h4 className="font-semibold flex items-center gap-2">
                        ⚡ Performance Optimization
                      </h4>
                      <p className="text-sm text-muted-foreground mt-2">
                        DC/AC ratio tuning and string configuration optimization suggestions.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Note: These recommendations are supplementary and not part of core compliance requirements.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bom" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Bill of Materials (BoM) & Bill of Quantities (BoQ)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!extractedData ? (
                    <p className="text-sm text-muted-foreground">
                      Run <strong>Analyze & Extract</strong> first to generate BoM/BoQ from your uploaded files.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard title="Modules" value={extractedData.pvParameters.moduleCount} icon={Calculator} variant="default" />
                        <StatCard title="Strings" value={extractedData.pvParameters.stringCount} icon={Calculator} variant="default" />
                        <StatCard title="Inverters" value={extractedData.pvParameters.inverterCount} icon={Calculator} variant="default" />
                      </div>

                      <TraceabilityPanel
                        trace={extractedData.trace}
                        items={[
                          { label: 'Module count', traceKey: 'pvParameters.moduleCount', fallbackKeys: ['moduleCount'] },
                          { label: 'String count', traceKey: 'pvParameters.stringCount', fallbackKeys: ['stringCount'] },
                          { label: 'Modules per string', traceKey: 'pvParameters.modulesPerString', fallbackKeys: ['modulesPerString'] },
                          { label: 'Strings per MPPT', traceKey: 'pvParameters.stringsPerMPPT', fallbackKeys: ['stringsPerMPPT', 'stringsPerMPPT'] },
                          { label: 'Inverter count', traceKey: 'pvParameters.inverterCount', fallbackKeys: ['inverterCount'] },
                          { label: 'Total capacity', traceKey: 'pvParameters.totalCapacity', fallbackKeys: ['totalCapacity'] },
                          { label: 'Max DC voltage', traceKey: 'pvParameters.maxVoltage', fallbackKeys: ['maxVoltage'] },
                          { label: 'DC cable length', traceKey: 'cableSummary.dcLength', fallbackKeys: ['dcLength'] },
                          { label: 'AC cable length', traceKey: 'cableSummary.acLength', fallbackKeys: ['acLength'] },
                        ]}
                      />

                      {/* BoM */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold">BoM</h3>
                        {extractedData.bom && extractedData.bom.length > 0 ? (
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="w-[160px]">Category</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead className="w-[110px]">Qty</TableHead>
                                  <TableHead className="w-[90px]">Unit</TableHead>
                                  <TableHead className="w-[260px]">Source</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {extractedData.bom.map((it, idx) => (
                                  <TableRow key={idx} className="hover:bg-muted/30">
                                    <TableCell className="font-medium">{it.category}</TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <div className="text-sm">{it.description}</div>
                                        {it.specification && (
                                          <div className="text-xs text-muted-foreground font-mono">{it.specification}</div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono">{it.quantity ?? '—'}</TableCell>
                                    <TableCell className="font-mono">{it.unit}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {it.source ? `${it.source.sourceFile} • ${it.source.sourceReference}` : '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No BoM items extracted.</p>
                        )}
                      </div>

                      {/* BoQ */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold">BoQ</h3>
                        {extractedData.boq && extractedData.boq.length > 0 ? (
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="w-[160px]">Category</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead className="w-[110px]">Qty</TableHead>
                                  <TableHead className="w-[90px]">Unit</TableHead>
                                  <TableHead className="w-[260px]">Source</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {extractedData.boq.map((it, idx) => (
                                  <TableRow key={idx} className="hover:bg-muted/30">
                                    <TableCell className="font-medium">{it.category}</TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <div className="text-sm">{it.description}</div>
                                        {it.specification && (
                                          <div className="text-xs text-muted-foreground font-mono">{it.specification}</div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono">{it.quantity ?? '—'}</TableCell>
                                    <TableCell className="font-mono">{it.unit}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {it.source ? `${it.source.sourceFile} • ${it.source.sourceReference}` : '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No BoQ items extracted.</p>
                        )}
                      </div>

                      {extractedData.notes && extractedData.notes.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {extractedData.notes.map((n, idx) => (
                            <div key={idx}>• {n}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
              </Tabs>
            </div>

            {/* Deliverables Sidebar */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <DeliverablesPanel
                deliverables={displayDeliverables}
                onGenerateMissing={handleGenerateMissing}
                onRegenerateAll={handleRegenerateAll}
                onExportPackage={handleExportPackage}
                isGenerating={isGenerating}
                submissionNumber={submissions.length}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Analyze
          </Button>

          {findings.length > 0 && (
            <Button
              onClick={handleRunReview}
              variant="outline"
              className="gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Re-run Review
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesignReview;
