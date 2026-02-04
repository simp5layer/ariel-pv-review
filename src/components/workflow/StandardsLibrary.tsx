import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import FileUploadZone from '@/components/ui/FileUploadZone';
import { StandardDocument, UploadedFile } from '@/types/project';
import { 
  Book, 
  ArrowLeft, 
  Trash2, 
  Shield, 
  FileText, 
  Search
} from 'lucide-react';
import { format } from 'date-fns';

interface StandardsLibraryProps {
  onBack: () => void;
}

const StandardsLibrary: React.FC<StandardsLibraryProps> = ({ onBack }) => {
  const [standards, setStandards] = useState<StandardDocument[]>([
    // Demo data
    {
      id: 'std-1',
      name: 'IEC 62548:2016 - PV Arrays Design Requirements',
      version: '2016',
      category: 'IEC',
      uploadedAt: new Date('2024-01-10'),
      file: { id: 'f1', name: 'IEC_62548_2016.pdf', type: 'pdf', size: 2500000, uploadedAt: new Date(), status: 'completed' },
      isGlobal: true
    },
    {
      id: 'std-2',
      name: 'SEC Distribution Code - PV Connection Standards',
      version: '2023',
      category: 'SEC',
      uploadedAt: new Date('2024-01-15'),
      file: { id: 'f2', name: 'SEC_Distribution_Code.pdf', type: 'pdf', size: 3200000, uploadedAt: new Date(), status: 'completed' },
      isGlobal: true
    },
    {
      id: 'std-3',
      name: 'SBC 401 - Electrical Systems Requirements',
      version: '2022',
      category: 'SBC',
      uploadedAt: new Date('2024-02-01'),
      file: { id: 'f3', name: 'SBC_401_Electrical.pdf', type: 'pdf', size: 1800000, uploadedAt: new Date(), status: 'completed' },
      isGlobal: true
    }
  ]);
  
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilesAdded = (files: UploadedFile[]) => {
    const newStandards: StandardDocument[] = files.map((file, index) => ({
      id: `std-${Date.now()}-${index}`,
      name: file.name.replace(/\.[^/.]+$/, ''), // Use filename without extension as name
      category: 'OTHER' as StandardDocument['category'],
      uploadedAt: new Date(),
      file: { ...file, type: 'pdf' as const },
      isGlobal: true
    }));
    setStandards([...standards, ...newStandards]);
  };

  const handleDeleteStandard = (id: string) => {
    setStandards(standards.filter(s => s.id !== id));
  };

  const filteredStandards = standards.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-full bg-background py-8">
      <div className="max-w-6xl mx-auto px-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Book className="w-7 h-7 text-primary" />
              Standards Library
            </h1>
            <p className="text-muted-foreground">
              Manage global standards for all PV design review projects
            </p>
          </div>
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        {/* Stats Card */}
        <Card className="group hover:border-primary/50 transition-colors">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Total Standards</p>
              <p className="text-xs text-muted-foreground">{standards.length} document{standards.length !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Standards */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Standards</CardTitle>
            <CardDescription>
              Upload international or national standards documents for use across all projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadZone
              onFilesAdded={handleFilesAdded}
              acceptedTypes={['.pdf']}
              label="Upload standard documents"
              description="PDF files only - drag and drop or click to browse"
            />
          </CardContent>
        </Card>

        {/* Standards List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Library Contents ({standards.length})</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search standards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Document Name</TableHead>
                    <TableHead className="w-[150px]">Uploaded</TableHead>
                    <TableHead className="w-[100px]">Size</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStandards.map((standard) => (
                    <TableRow key={standard.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="font-medium">{standard.file.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(standard.uploadedAt, 'PP')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {(standard.file.size / (1024 * 1024)).toFixed(1)} MB
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteStandard(standard.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStandards.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'No standards match your search' : 'No standards uploaded yet'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Info Notice */}
        <div className="bg-accent/50 border border-accent-foreground/10 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">Global Standards Usage</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Standards uploaded here are automatically available for all design reviews. 
                During project review, the AI will reference these documents for clause-level 
                compliance verification. Projects can optionally add project-specific standards overrides.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandardsLibrary;
