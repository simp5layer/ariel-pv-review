import React, { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FileUploadZone from '@/components/ui/FileUploadZone';
import { UploadedFile } from '@/types/project';
import { FileText, ArrowRight, ArrowLeft, Book, Scale, Shield } from 'lucide-react';

const standardCategories = [
  { 
    id: 'sec', 
    name: 'SEC Standards', 
    description: 'Saudi Electricity Company Distribution Code',
    icon: Shield 
  },
  { 
    id: 'iec', 
    name: 'IEC Standards', 
    description: 'International Electrotechnical Commission',
    icon: Scale 
  },
  { 
    id: 'saso', 
    name: 'SASO Standards', 
    description: 'Saudi Standards, Metrology and Quality Org',
    icon: Book 
  },
  { 
    id: 'other', 
    name: 'Other Standards', 
    description: 'NEC, manufacturer specs, project-specific',
    icon: FileText 
  }
];

const StandardsUpload: React.FC = () => {
  const { currentProject, addStandardFile, setCurrentStep } = useProject();
  const [uploadedStandards, setUploadedStandards] = useState<UploadedFile[]>(
    currentProject?.standardFiles || []
  );

  const handleFilesAdded = (files: UploadedFile[]) => {
    const standardFiles = files.map(f => ({ ...f, type: 'standard' as const }));
    setUploadedStandards([...uploadedStandards, ...standardFiles]);
    standardFiles.forEach(addStandardFile);
  };

  const handleFileRemove = (fileId: string) => {
    setUploadedStandards(uploadedStandards.filter(f => f.id !== fileId));
  };

  return (
    <div className="min-h-full bg-background py-8">
      <div className="max-w-4xl mx-auto px-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Standards Upload</h1>
          <p className="text-muted-foreground">
            Upload applicable standards documents for clause-level compliance verification
          </p>
        </div>

        {/* Standards Categories */}
        <div className="grid gap-4 sm:grid-cols-2">
          {standardCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.id} className="group hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Standards Documents</CardTitle>
            <CardDescription>
              Upload PDF documents containing SEC, IEC, SASO, or project-specific standards.
              These will be indexed for clause-level referencing during review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadZone
              onFilesAdded={handleFilesAdded}
              acceptedTypes={['.pdf']}
              existingFiles={uploadedStandards}
              onFileRemove={handleFileRemove}
              label="Drop standards documents here"
              description="PDF files containing applicable standards and codes"
            />
          </CardContent>
        </Card>

        {/* Info Notice */}
        <div className="bg-accent/50 border border-accent-foreground/10 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">AI-Powered Standards Discovery</h4>
              <p className="text-sm text-muted-foreground mt-1">
                During review, the AI will automatically search for and cite relevant clauses from 
                uploaded standards. Additional regulatory requirements may be discovered and referenced 
                from the system knowledge base.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Analysis
          </Button>

          <Button
            onClick={() => setCurrentStep(3)}
            className="gap-2"
          >
            Continue to Review
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StandardsUpload;
