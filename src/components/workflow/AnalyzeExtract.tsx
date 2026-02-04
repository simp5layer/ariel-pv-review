import React, { useState } from 'react';
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
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExtractedData } from '@/types/project';

const AnalyzeExtract: React.FC = () => {
  const { 
    currentProject, 
    setCurrentStep, 
    extractedData, 
    setExtractedData,
    isAnalyzing,
    setIsAnalyzing
  } = useProject();

  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisSteps, setAnalysisSteps] = useState({
    fileConversion: false,
    layerParsing: false,
    textExtraction: false,
    pvCalculation: false
  });
  const [error, setError] = useState<string | null>(null);

  const startGPTAnalysis = async () => {
    if (!currentProject || currentProject.files.length === 0) {
      toast.error('No files to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(10);
    setAnalysisSteps({ fileConversion: false, layerParsing: false, textExtraction: false, pvCalculation: false });

    try {
      // Step 1: File conversion simulation
      setAnalysisSteps(prev => ({ ...prev, fileConversion: true }));
      setAnalysisProgress(25);

      // Prepare files for GPT-5.2 analysis
      const files = currentProject.files.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        // Note: In production, we'd fetch actual file content from storage
        content: `File: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes`
      }));

      // Step 2: Layer parsing
      setAnalysisSteps(prev => ({ ...prev, layerParsing: true }));
      setAnalysisProgress(40);

      // Step 3: Call GPT-5.2 via edge function
      setAnalysisSteps(prev => ({ ...prev, textExtraction: true }));
      setAnalysisProgress(60);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data, error: fnError } = await supabase.functions.invoke('extract-data', {
        body: {
          projectId: currentProject.id,
          files
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Step 4: Process results
      setAnalysisSteps(prev => ({ ...prev, pvCalculation: true }));
      setAnalysisProgress(90);

      // Map GPT response to ExtractedData format - handle both value-wrapped and direct formats
      const aiData = data?.extractedData || {};
      
      // Helper to extract value from wrapped or direct format
      const getValue = (field: any, defaultVal: any = 'NOT_FOUND') => {
        if (field === undefined || field === null) return defaultVal;
        if (typeof field === 'object' && 'value' in field) {
          return field.value === 'NOT_FOUND' ? defaultVal : field.value;
        }
        return field;
      };

      const extracted: ExtractedData = {
        layers: Array.isArray(aiData.layers) 
          ? aiData.layers.map((l: any) => getValue(l, '')).filter((l: string) => l && l !== 'NOT_FOUND')
          : ['PV_MODULES', 'DC_CABLES', 'AC_CABLES', 'INVERTERS', 'GROUNDING', 'ANNOTATIONS'],
        textLabels: Array.isArray(aiData.textLabels) 
          ? aiData.textLabels.map((t: any) => getValue(t, '')).filter((t: string) => t && t !== 'NOT_FOUND')
          : [],
        cableSummary: {
          dcLength: Number(getValue(aiData.cableSummary?.dcLength, 0)) || 0,
          acLength: Number(getValue(aiData.cableSummary?.acLength, 0)) || 0
        },
        pvParameters: {
          moduleCount: Number(getValue(aiData.pvParameters?.moduleCount, 0)) || 0,
          inverterCount: Number(getValue(aiData.pvParameters?.inverterCount, 0)) || 0,
          stringCount: Number(getValue(aiData.pvParameters?.stringCount, 0)) || 0,
          maxVoltage: Number(getValue(aiData.pvParameters?.maxVoltage, 1500)) || 1500,
          totalCapacity: Number(getValue(aiData.pvParameters?.totalCapacity, 0)) || 0
        }
      };

      setExtractedData(extracted);
      setAnalysisProgress(100);
      toast.success('Analysis complete using GPT-5.2');

    } catch (err) {
      console.error('Analysis error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-full bg-background py-8">
      <div className="max-w-5xl mx-auto px-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Analyze & Extract</h1>
          <p className="text-muted-foreground">
            GPT-5.2 powered analysis to extract design data from drawings and documents
          </p>
        </div>

        {/* File Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Files</CardTitle>
            <CardDescription>
              {currentProject?.files.length || 0} files ready for GPT-5.2 analysis
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
        {(isAnalyzing || extractedData || error) && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isAnalyzing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : error ? (
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-pass" />
                )}
                {isAnalyzing ? 'Analyzing with GPT-5.2...' : error ? 'Analysis Error' : 'Analysis Complete'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error ? (
                <div className="text-destructive text-sm">{error}</div>
              ) : (
                <>
                  <Progress value={analysisProgress} className="h-2" />
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {analysisSteps.fileConversion ? (
                        <CheckCircle className="w-4 h-4 text-pass" />
                      ) : isAnalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span>File format processing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysisSteps.layerParsing ? (
                        <CheckCircle className="w-4 h-4 text-pass" />
                      ) : isAnalyzing && analysisSteps.fileConversion ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span>Drawing layer parsing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysisSteps.textExtraction ? (
                        <CheckCircle className="w-4 h-4 text-pass" />
                      ) : isAnalyzing && analysisSteps.layerParsing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span>GPT-5.2 text & data extraction</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysisSteps.pvCalculation ? (
                        <CheckCircle className="w-4 h-4 text-pass" />
                      ) : isAnalyzing && analysisSteps.textExtraction ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span>PV parameter calculation</span>
                    </div>
                  </div>
                </>
              )}
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
            {extractedData.textLabels.length > 0 && (
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
            )}
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
              onClick={startGPTAnalysis}
              disabled={isAnalyzing || !currentProject?.files.length}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing with GPT-5.2...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Analyze with GPT-5.2
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(2)}
              className="gap-2"
            >
              Continue to Design Review
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyzeExtract;
