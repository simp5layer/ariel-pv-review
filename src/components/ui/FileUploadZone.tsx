import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Upload, File, X, FileText, Table, Image } from 'lucide-react';
import { UploadedFile } from '@/types/project';
import { Button } from './button';

interface FileUploadZoneProps {
  onFilesAdded: (files: UploadedFile[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  existingFiles?: UploadedFile[];
  onFileRemove?: (fileId: string) => void;
  label?: string;
  description?: string;
}

const fileTypeIcons: Record<string, React.ElementType> = {
  dwg: Image,
  pdf: FileText,
  excel: Table,
  datasheet: FileText,
  standard: FileText
};

const getFileType = (filename: string): UploadedFile['type'] => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'dwg' || ext === 'dxf') return 'dwg';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'excel';
  return 'datasheet';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesAdded,
  acceptedTypes = ['.dwg', '.dxf', '.pdf', '.xlsx', '.xls', '.csv'],
  maxFiles = 20,
  existingFiles = [],
  onFileRemove,
  label = 'Upload Files',
  description = 'Drag and drop files here, or click to browse'
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback((fileList: FileList) => {
    const files: UploadedFile[] = Array.from(fileList).map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      name: file.name,
      type: getFileType(file.name),
      size: file.size,
      uploadedAt: new Date(),
      status: 'completed' as const
    }));
    onFilesAdded(files);
  }, [onFilesAdded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">{label}</p>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Accepted: {acceptedTypes.join(', ')}
            </p>
          </div>
        </div>
      </div>

      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Uploaded Files ({existingFiles.length})
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {existingFiles.map((file) => {
              const Icon = fileTypeIcons[file.type] || File;
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {file.type.toUpperCase()}
                    </p>
                  </div>
                  {onFileRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onFileRemove(file.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;
