import React, { useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import StatCard from '@/components/ui/StatCard';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Layers, 
  Type, 
  Cable, 
  Cpu, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  CheckCircle
} from 'lucide-react';

const AnalyzeExtract: React.FC = () => {
  const { 
    currentProject, 
    setCurrentStep, 
    extractedData, 
    isAnalyzing,
    startAnalysis
  } = useProject();

  const analysisProgress = isAnalyzing ? 65 : (extractedData ? 100 : 0);

  return (
    <div className="min-h-full bg-background py-8">
      <div className="max-w-5xl mx-auto px-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Analyze & Extract</h1>
          <p className="text-muted-foreground">
            Process uploaded files to extract design data from drawings and documents
          </p>
        </div>

        {/* File Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Files</CardTitle>
            <CardDescription>
              {currentProject?.files.length || 0} files ready for analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {currentProject?.files.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.type.toUpperCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Progress */}
        {(isAnalyzing || extractedData) && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isAnalyzing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-pass" />
                )}
                {isAnalyzing ? 'Analyzing Files...' : 'Analysis Complete'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={analysisProgress} className="h-2" />
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-pass" />
                  <span>DWG to DXF conversion</span>
                </div>
                <div className="flex items-center gap-2">
                  {analysisProgress >= 40 ? (
                    <CheckCircle className="w-4 h-4 text-pass" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  <span>Drawing layer parsing</span>
                </div>
                <div className="flex items-center gap-2">
                  {analysisProgress >= 70 ? (
                    <CheckCircle className="w-4 h-4 text-pass" />
                  ) : analysisProgress >= 40 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span>Text and label extraction</span>
                </div>
                <div className="flex items-center gap-2">
                  {analysisProgress === 100 ? (
                    <CheckCircle className="w-4 h-4 text-pass" />
                  ) : analysisProgress >= 70 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span>PV parameter calculation</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extracted Data Display */}
        {extractedData && (
          <div className="space-y-6 animate-slide-up">
            {/* Stats Overview */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Modules"
                value={extractedData.pvParameters.moduleCount.toLocaleString()}
                subtitle={`${extractedData.pvParameters.totalCapacity} kWp`}
                icon={Cpu}
                variant="primary"
              />
              <StatCard
                title="String Count"
                value={extractedData.pvParameters.stringCount}
                subtitle={`${extractedData.pvParameters.inverterCount} Inverters`}
                icon={Cable}
                variant="default"
              />
              <StatCard
                title="DC Cable Length"
                value={`${(extractedData.cableSummary.dcLength / 1000).toFixed(1)} km`}
                subtitle="Total calculated"
                icon={Cable}
                variant="warning"
              />
              <StatCard
                title="Max DC Voltage"
                value={`${extractedData.pvParameters.maxVoltage}V`}
                subtitle="System voltage"
                icon={Layers}
                variant="success"
              />
            </div>

            {/* Detected Layers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Detected Drawing Layers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {extractedData.layers.map((layer, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-muted rounded-full text-sm font-mono"
                    >
                      {layer}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Extracted Labels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="w-5 h-5 text-primary" />
                  Extracted Text Labels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {extractedData.textLabels.map((label, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="w-6 h-6 rounded bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
                        {index + 1}
                      </div>
                      <span className="text-sm font-mono">{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(0)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Setup
          </Button>

          {!extractedData ? (
            <Button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analyze Project
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(2)}
              className="gap-2"
            >
              Continue to Standards
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyzeExtract;
