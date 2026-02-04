import React, { useState, useRef } from 'react';
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
import { useStandardsLibrary } from '@/hooks/useStandardsLibrary';
import { 
  Book, 
  ArrowLeft, 
  Trash2, 
  Shield, 
  FileText, 
  Search,
  Upload,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface StandardsLibraryProps {
  onBack: () => void;
}

const StandardsLibrary: React.FC<StandardsLibraryProps> = ({ onBack }) => {
  const { standards, isLoading, isUploading, uploadStandards, deleteStandard } = useStandardsLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accepted file types for standards documents
  const acceptedTypes = [
    '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', // Documents
    '.xls', '.xlsx', '.csv', // Spreadsheets
    '.ppt', '.pptx', // Presentations
  ];
  
  const acceptedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // Filter to accepted document types
    const validFiles = Array.from(files).filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return acceptedTypes.includes(ext) || acceptedMimeTypes.includes(f.type);
    });
    
    if (validFiles.length === 0) {
      return;
    }

    await uploadStandards(validFiles);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleDeleteStandard = async (id: string) => {
    await deleteStandard(id);
  };

  const filteredStandards = standards.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-full bg-background py-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading standards library...</p>
        </div>
      </div>
    );
  }

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
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 hover:bg-muted/50",
                isUploading && "opacity-50 pointer-events-none"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv,.ppt,.pptx"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                  isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {isUploading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <p className="text-base font-medium text-foreground">
                    {isUploading ? 'Uploading...' : 'Upload standard documents'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF, Word, Excel, Text files - drag and drop or click to browse
                  </p>
                </div>
              </div>
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
                          <span className="font-medium">{standard.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(standard.uploadedAt, 'PP')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {(standard.fileSize / (1024 * 1024)).toFixed(1)} MB
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
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
