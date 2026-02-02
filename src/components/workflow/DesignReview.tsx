import React from 'react';
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
  FileCheck
} from 'lucide-react';
import { format } from 'date-fns';

const DesignReview: React.FC = () => {
  const {
    setCurrentStep,
    findings,
    submissions,
    isReviewing,
    setIsReviewing
  } = useProject();

  const handleRunReview = () => {
    setIsReviewing(true);
  };

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const majorCount = findings.filter(f => f.severity === 'major').length;
  const minorCount = findings.filter(f => f.severity === 'minor').length;
  const passCount = findings.filter(f => f.severity === 'pass').length;
  const totalFindings = findings.length;
  const compliancePercentage = totalFindings > 0 
    ? Math.round((passCount / totalFindings) * 100) 
    : 0;

  const latestSubmission = submissions[submissions.length - 1];

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

        {/* Results Dashboard */}
        {findings.length > 0 && (
          <Tabs defaultValue="findings" className="space-y-6">
            <TabsList>
              <TabsTrigger value="findings" className="gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Compliance Findings
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
          </Tabs>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(2)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Standards
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
