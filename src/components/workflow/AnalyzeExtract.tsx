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
  AlertTriangle,
  Zap,
  Battery,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExtractedData } from '@/types/project';

interface InverterSpec {
  model?: string | null;
  manufacturer?: string | null;
  ratedPower?: number | null;
  maxDcVoltage?: number | null;
  mpptVoltageMin?: number | null;
  mpptVoltageMax?: number | null;
  maxInputCurrent?: number | null;
  mpptCount?: number | null;
  quantity?: number | null;
  source?: { sourceFile: string; sourceReference: string };
}

interface ModuleSpec {
  model?: string | null;
  manufacturer?: string | null;
  pmax?: number | null;
  voc?: number | null;
  vmp?: number | null;
  isc?: number | null;
  imp?: number | null;
  tempCoeffVoc?: number | null;
  tempCoeffPmax?: number | null;
  source?: { sourceFile: string; sourceReference: string };
}

interface ExtendedExtractedData extends ExtractedData {
  inverterSpecs?: InverterSpec[];
  moduleSpecs?: ModuleSpec;
  cableSummary: {
    dcLength: number;
    acLength: number;
    dcCableSpec?: string | null;
    acCableSpec?: string | null;
  };
  pvParameters: ExtractedData['pvParameters'] & {
    modulesPerString?: number;
    maxVoltageCalculation?: string | null;
    acCapacity?: number;
  };
}

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

  // Cast to extended type for new fields
  const extendedData = extractedData as ExtendedExtractedData | null;

  // Poll for job completion
  const pollJobStatus = async (jobId: string): Promise<any> => {
    const maxAttempts = 90;
    const interval = 2000;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("status, progress, result, error")
        .eq("id", jobId)
        .single();

      if (error) throw new Error("Failed to poll job status");

      // Update progress based on job progress
      if (data.progress) {
        setAnalysisProgress(data.progress);
        if (data.progress >= 20) setAnalysisSteps(prev => ({ ...prev, fileConversion: true }));
        if (data.progress >= 40) setAnalysisSteps(prev => ({ ...prev, layerParsing: true }));
        if (data.progress >= 60) setAnalysisSteps(prev => ({ ...prev, textExtraction: true }));
        if (data.progress >= 90) setAnalysisSteps(prev => ({ ...prev, pvCalculation: true }));
      }

      if (data.status === "completed") {
        return data.result;
      }
      if (data.status === "failed") {
        throw new Error(data.error || "Job failed");
      }

      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error("Analysis timed out. Please try again.");
  };

  const startGPTAnalysis = async () => {
    if (!currentProject || currentProject.files.length === 0) {
      toast.error('No files to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(5);
    setAnalysisSteps({ fileConversion: false, layerParsing: false, textExtraction: false, pvCalculation: false });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated');
      }

      toast.info('Starting GPT-5.2 analysis. This may take a minute...');

      const { data, error: fnError } = await supabase.functions.invoke('extract-data', {
        body: {
          projectId: currentProject.id
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

      // Poll for results if we got a jobId
      let resultData = data;
      if (data?.jobId) {
        resultData = await pollJobStatus(data.jobId);
      }

      const aiData = resultData?.extractedData as Partial<ExtendedExtractedData> | undefined;
      if (!aiData) {
        throw new Error('Extraction returned no data');
      }

      const extracted: ExtractedData = {
        layers: Array.isArray(aiData.layers) ? aiData.layers : [],
        textLabels: Array.isArray(aiData.textLabels) ? aiData.textLabels : [],
        cableSummary: {
          dcLength: Number(aiData.cableSummary?.dcLength ?? 0) || 0,
          acLength: Number(aiData.cableSummary?.acLength ?? 0) || 0,
        },
        pvParameters: {
          moduleCount: Number(aiData.pvParameters?.moduleCount ?? 0) || 0,
          inverterCount: Number(aiData.pvParameters?.inverterCount ?? 0) || 0,
          stringCount: Number(aiData.pvParameters?.stringCount ?? 0) || 0,
          arrayCount: Number(aiData.pvParameters?.arrayCount ?? 0) || 0,
          maxVoltage: Number(aiData.pvParameters?.maxVoltage ?? 0) || 0,
          totalCapacity: Number(aiData.pvParameters?.totalCapacity ?? 0) || 0,
        },
        bom: aiData.bom,
        boq: aiData.boq,
        trace: aiData.trace,
        missingData: aiData.missingData,
        notes: aiData.notes,
        moduleParameters: aiData.moduleParameters,
        inverterParameters: aiData.inverterParameters,
      };

      // Add extended fields
      const extendedExtracted = extracted as ExtendedExtractedData;
      extendedExtracted.inverterSpecs = aiData.inverterSpecs;
      extendedExtracted.moduleSpecs = aiData.moduleSpecs;
      extendedExtracted.cableSummary.dcCableSpec = aiData.cableSummary?.dcCableSpec;
      extendedExtracted.cableSummary.acCableSpec = aiData.cableSummary?.acCableSpec;
      extendedExtracted.pvParameters.modulesPerString = Number(aiData.pvParameters?.modulesPerString ?? 0) || 0;
      extendedExtracted.pvParameters.maxVoltageCalculation = aiData.pvParameters?.maxVoltageCalculation;
      extendedExtracted.pvParameters.acCapacity = Number(aiData.pvParameters?.acCapacity ?? 0) || 0;

      setExtractedData(extendedExtracted);
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

  // Format DC cable length - show in meters (convert to mm only for display if small)
  const formatCableLength = (meters: number): string => {
    if (meters === 0) return 'N/A';
    if (meters < 1) {
      return `${(meters * 1000).toFixed(0)} mm`;
    }
    return `${meters.toLocaleString()} m`;
  };

  return (
    <div className="min-h-full bg-background py-8">
      <div className="max-w-6xl mx-auto px-6 space-y-8">
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
                      <span>PV parameter calculation & standards compliance</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Extracted Data Display */}
        {extendedData && (
          <div className="space-y-6 animate-slide-up">
            {/* Stats Overview - Row 1 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Modules"
                value={extendedData.pvParameters.moduleCount.toLocaleString()}
                subtitle={`${extendedData.pvParameters.totalCapacity} kWp DC`}
                icon={Cpu}
                variant="primary"
              />
              <StatCard
                title="String Count"
                value={extendedData.pvParameters.stringCount || 'N/A'}
                subtitle={extendedData.pvParameters.modulesPerString ? `${extendedData.pvParameters.modulesPerString} modules/string` : 'Not calculated'}
                icon={Cable}
                variant="default"
              />
              <StatCard
                title="Inverters"
                value={extendedData.pvParameters.inverterCount}
                subtitle={extendedData.pvParameters.acCapacity ? `${extendedData.pvParameters.acCapacity} kW AC` : 'AC capacity N/A'}
                icon={Battery}
                variant="warning"
              />
              <StatCard
                title="Array Count"
                value={extendedData.pvParameters.arrayCount || 'N/A'}
                subtitle="Sub-arrays"
                icon={Layers}
                variant="default"
              />
            </div>

            {/* Stats Overview - Row 2 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="DC Cable Length"
                value={formatCableLength(extendedData.cableSummary.dcLength)}
                subtitle={extendedData.cableSummary.dcCableSpec || 'Specification N/A'}
                icon={Cable}
                variant="default"
              />
              <StatCard
                title="AC Cable Length"
                value={formatCableLength(extendedData.cableSummary.acLength)}
                subtitle={extendedData.cableSummary.acCableSpec || 'Specification N/A'}
                icon={Cable}
                variant="default"
              />
              <StatCard
                title="Max DC Voltage"
                value={extendedData.pvParameters.maxVoltage ? `${extendedData.pvParameters.maxVoltage} V` : 'N/A'}
                subtitle={extendedData.pvParameters.maxVoltageCalculation ? 'Calculated per IEC' : 'Needs module datasheet'}
                icon={Zap}
                variant="success"
              />
            </div>

            {/* Inverter Specifications */}
            {extendedData.inverterSpecs && extendedData.inverterSpecs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Inverter Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Model</th>
                          <th className="text-left py-2 px-3 font-medium">Power (kW)</th>
                          <th className="text-left py-2 px-3 font-medium">Max DC (V)</th>
                          <th className="text-left py-2 px-3 font-medium">MPPT Range (V)</th>
                          <th className="text-left py-2 px-3 font-medium">Max Current (A)</th>
                          <th className="text-left py-2 px-3 font-medium">MPPT Channels</th>
                          <th className="text-left py-2 px-3 font-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extendedData.inverterSpecs.map((inv, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2 px-3">
                              {inv.manufacturer && inv.model 
                                ? `${inv.manufacturer} ${inv.model}` 
                                : inv.model || 'Not specified'}
                            </td>
                            <td className="py-2 px-3">{inv.ratedPower ?? 'N/A'}</td>
                            <td className="py-2 px-3">{inv.maxDcVoltage ?? 'N/A'}</td>
                            <td className="py-2 px-3">
                              {inv.mpptVoltageMin && inv.mpptVoltageMax 
                                ? `${inv.mpptVoltageMin} - ${inv.mpptVoltageMax}` 
                                : 'N/A'}
                            </td>
                            <td className="py-2 px-3">{inv.maxInputCurrent ?? 'N/A'}</td>
                            <td className="py-2 px-3">{inv.mpptCount ?? 'N/A'}</td>
                            <td className="py-2 px-3 font-medium">{inv.quantity ?? 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {extendedData.inverterSpecs[0]?.source && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Source: {extendedData.inverterSpecs[0].source.sourceFile} - {extendedData.inverterSpecs[0].source.sourceReference}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Module Specifications */}
            {extendedData.moduleSpecs && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    Module Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Model</p>
                      <p className="font-medium">
                        {extendedData.moduleSpecs.manufacturer && extendedData.moduleSpecs.model 
                          ? `${extendedData.moduleSpecs.manufacturer} ${extendedData.moduleSpecs.model}`
                          : extendedData.moduleSpecs.model || 'Not specified'}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Peak Power (Pmax)</p>
                      <p className="font-medium">{extendedData.moduleSpecs.pmax ? `${extendedData.moduleSpecs.pmax} Wp` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Voc (Open Circuit)</p>
                      <p className="font-medium">{extendedData.moduleSpecs.voc ? `${extendedData.moduleSpecs.voc} V` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Vmp (Max Power)</p>
                      <p className="font-medium">{extendedData.moduleSpecs.vmp ? `${extendedData.moduleSpecs.vmp} V` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Isc (Short Circuit)</p>
                      <p className="font-medium">{extendedData.moduleSpecs.isc ? `${extendedData.moduleSpecs.isc} A` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Imp (Max Power)</p>
                      <p className="font-medium">{extendedData.moduleSpecs.imp ? `${extendedData.moduleSpecs.imp} A` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Temp Coeff Voc</p>
                      <p className="font-medium">{extendedData.moduleSpecs.tempCoeffVoc ? `${extendedData.moduleSpecs.tempCoeffVoc} %/°C` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Temp Coeff Pmax</p>
                      <p className="font-medium">{extendedData.moduleSpecs.tempCoeffPmax ? `${extendedData.moduleSpecs.tempCoeffPmax} %/°C` : 'N/A'}</p>
                    </div>
                  </div>
                  {extendedData.moduleSpecs.source && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Source: {extendedData.moduleSpecs.source.sourceFile} - {extendedData.moduleSpecs.source.sourceReference}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Max DC Voltage Calculation */}
            {extendedData.pvParameters.maxVoltageCalculation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-warning" />
                    Max DC Voltage Calculation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-muted/30 rounded-lg font-mono text-sm">
                    {extendedData.pvParameters.maxVoltageCalculation}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Calculated per IEC 62548 / NEC 690 with temperature correction
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Detected Layers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Detected Drawing Layers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {extendedData.layers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {extendedData.layers.map((layer, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-muted rounded-full text-sm font-mono"
                      >
                        {layer}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No CAD layers detected. This is common with PDFs that don't contain layer information. For full layer extraction, upload native DWG/DXF files.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Missing Data */}
            {extendedData.missingData && extendedData.missingData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    Missing / Insufficient Data
                  </CardTitle>
                  <CardDescription>
                    The following data could not be extracted. Upload additional documents to complete the analysis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {extendedData.missingData.map((m, idx) => (
                      <li key={idx} className="p-3 rounded-lg bg-muted/30 border">
                        <div className="font-medium">{m.field}</div>
                        <div className="text-muted-foreground">{m.reason}</div>
                        {m.sourceHint && (
                          <div className="text-xs text-muted-foreground mt-1 font-mono">
                            💡 Hint: {m.sourceHint}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Engineering Notes */}
            {extendedData.notes && extendedData.notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-pass" />
                    Engineering Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {extendedData.notes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Extracted Labels */}
            {extendedData.textLabels.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="w-5 h-5 text-primary" />
                    Extracted Equipment Labels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {extendedData.textLabels.map((label, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                      >
                        <div className="w-6 h-6 rounded bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
                          {index + 1}
                        </div>
                        <span className="text-sm font-mono truncate">{label}</span>
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
