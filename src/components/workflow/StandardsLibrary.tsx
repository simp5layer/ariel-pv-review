import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Scale, 
  FileText, 
  Building,
  Zap,
  Globe,
  Search
} from 'lucide-react';
import { format } from 'date-fns';

const standardCategories = [
  { value: 'IEC', label: 'IEC Standards', icon: Globe, description: 'International Electrotechnical Commission' },
  { value: 'SEC', label: 'SEC Standards', icon: Zap, description: 'Saudi Electricity Company' },
  { value: 'SBC', label: 'SBC Standards', icon: Building, description: 'Saudi Building Code' },
  { value: 'SASO', label: 'SASO Standards', icon: Shield, description: 'Saudi Standards Organization' },
  { value: 'MOMRA', label: 'MOMRA Requirements', icon: Building, description: 'Ministry of Municipal & Rural Affairs' },
  { value: 'SERA', label: 'SERA Grid Codes', icon: Zap, description: 'Saudi Electricity Regulatory Authority' },
  { value: 'WERA', label: 'WERA Regulations', icon: Scale, description: 'Water & Electricity Regulatory Authority' },
  { value: 'NEC', label: 'NEC Standards', icon: FileText, description: 'National Electrical Code' },
  { value: 'OTHER', label: 'Other Standards', icon: FileText, description: 'Manufacturer specs, project-specific' },
] as const;

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
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [standardName, setStandardName] = useState('');
  const [standardVersion, setStandardVersion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);

  const handleFilesAdded = (files: UploadedFile[]) => {
    setPendingFiles([...pendingFiles, ...files]);
  };

  const handleFileRemove = (fileId: string) => {
    setPendingFiles(pendingFiles.filter(f => f.id !== fileId));
  };

  const handleAddStandard = () => {
    if (!selectedCategory || !standardName.trim() || pendingFiles.length === 0) return;

    const newStandards: StandardDocument[] = pendingFiles.map((file, index) => ({
      id: `std-${Date.now()}-${index}`,
      name: standardName,
      version: standardVersion || undefined,
      category: selectedCategory as StandardDocument['category'],
      uploadedAt: new Date(),
      file: { ...file, type: 'pdf' as const },
      isGlobal: true
    }));

    setStandards([...standards, ...newStandards]);
    setSelectedCategory('');
    setStandardName('');
    setStandardVersion('');
    setPendingFiles([]);
  };

  const handleDeleteStandard = (id: string) => {
    setStandards(standards.filter(s => s.id !== id));
  };

  const filteredStandards = standards.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryIcon = (category: string) => {
    const cat = standardCategories.find(c => c.value === category);
    return cat ? cat.icon : FileText;
  };

  const getCategoryLabel = (category: string) => {
    const cat = standardCategories.find(c => c.value === category);
    return cat ? cat.label : category;
  };

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

        {/* Category Overview */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {standardCategories.slice(0, 5).map((cat) => {
            const Icon = cat.icon;
            const count = standards.filter(s => s.category === cat.value).length;
            return (
              <Card key={cat.value} className="group hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{cat.value}</p>
                    <p className="text-xs text-muted-foreground">{count} document{count !== 1 ? 's' : ''}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add New Standard */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Standard</CardTitle>
            <CardDescription>
              Upload standards documents to the global library for use across all projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Standard Category *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {standardCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="w-4 h-4" />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Standard Name *</Label>
                <Input
                  placeholder="e.g., IEC 62548:2016"
                  value={standardName}
                  onChange={(e) => setStandardName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Version/Date</Label>
                <Input
                  placeholder="e.g., 2023 or Rev. 3"
                  value={standardVersion}
                  onChange={(e) => setStandardVersion(e.target.value)}
                />
              </div>
            </div>

            <FileUploadZone
              onFilesAdded={handleFilesAdded}
              acceptedTypes={['.pdf']}
              existingFiles={pendingFiles}
              onFileRemove={handleFileRemove}
              label="Upload standard documents"
              description="PDF files only"
            />

            <div className="flex justify-end">
              <Button 
                onClick={handleAddStandard}
                disabled={!selectedCategory || !standardName.trim() || pendingFiles.length === 0}
                className="gap-2"
              >
                Add to Library
              </Button>
            </div>
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
                    <TableHead className="w-[100px]">Category</TableHead>
                    <TableHead>Standard Name</TableHead>
                    <TableHead className="w-[100px]">Version</TableHead>
                    <TableHead className="w-[150px]">Uploaded</TableHead>
                    <TableHead className="w-[200px]">File</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStandards.map((standard) => {
                    const Icon = getCategoryIcon(standard.category);
                    return (
                      <TableRow key={standard.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="font-mono text-xs">{standard.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{standard.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {standard.version || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(standard.uploadedAt, 'PP')}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate block max-w-[180px]">
                            {standard.file.name}
                          </span>
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
                    );
                  })}
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
