import React, { memo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, FileIcon, Loader2, AlertCircle, Check } from 'lucide-react';
import { useAgentActions, type UploadedFile } from '@inferencesh/sdk/agent';

// =============================================================================
// Types
// =============================================================================

export type FileUploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export interface FileUpload {
  id: string;
  file: File;
  status: FileUploadStatus;
  uploadedFile?: UploadedFile;
  error?: string;
}

export interface FileUploadManagerState {
  uploads: FileUpload[];
  addFiles: (files: File[]) => void;
  removeUpload: (id: string) => void;
  clearAll: () => void;
  getUploadedFiles: () => UploadedFile[];
  hasPendingUploads: boolean;
  hasCompletedUploads: boolean;
}

// =============================================================================
// Hook: useFileUploadManager (uploads files on select using SDK)
// =============================================================================

export function useFileUploadManager(): FileUploadManagerState {
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const { uploadFile } = useAgentActions();

  // Upload a single file
  const uploadSingleFile = useCallback(async (upload: FileUpload) => {
    // Set status to uploading
    setUploads(prev => prev.map(u =>
      u.id === upload.id ? { ...u, status: 'uploading' as FileUploadStatus } : u
    ));

    try {
      const uploadedFile = await uploadFile(upload.file);
      setUploads(prev => prev.map(u =>
        u.id === upload.id
          ? { ...u, status: 'completed' as FileUploadStatus, uploadedFile }
          : u
      ));
    } catch (err) {
      setUploads(prev => prev.map(u =>
        u.id === upload.id
          ? { ...u, status: 'failed' as FileUploadStatus, error: String(err) }
          : u
      ));
    }
  }, [uploadFile]);

  const addFiles = useCallback((files: File[]) => {
    const newUploads: FileUpload[] = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'pending' as FileUploadStatus,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    // Start uploading each file
    newUploads.forEach(upload => {
      uploadSingleFile(upload);
    });
  }, [uploadSingleFile]);

  const removeUpload = useCallback((id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setUploads([]);
  }, []);

  const getUploadedFiles = useCallback(() => {
    return uploads
      .filter(u => u.status === 'completed' && u.uploadedFile)
      .map(u => u.uploadedFile!);
  }, [uploads]);

  const hasPendingUploads = uploads.some(u => u.status === 'pending' || u.status === 'uploading');
  const hasCompletedUploads = uploads.some(u => u.status === 'completed');

  return {
    uploads,
    addFiles,
    removeUpload,
    clearAll,
    getUploadedFiles,
    hasPendingUploads,
    hasCompletedUploads,
  };
}

// =============================================================================
// File Type Helpers
// =============================================================================

function getFileType(file: File): 'image' | 'video' | 'text' | 'generic' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.json') ||
    file.name.endsWith('.xml') ||
    file.name.endsWith('.yaml') ||
    file.name.endsWith('.yml')
  ) {
    return 'text';
  }
  return 'generic';
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase() || '';
  return ext.length <= 4 ? ext : ext.slice(0, 4);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// =============================================================================
// FileUploadPreview Component
// =============================================================================

interface FileUploadPreviewProps {
  upload: FileUpload;
  onRemove: () => void;
  className?: string;
}

export const FileUploadPreview = memo(function FileUploadPreview({
  upload,
  onRemove,
  className,
}: FileUploadPreviewProps) {
  const { file, status } = upload;
  const fileType = getFileType(file);
  const previewUrl = (fileType === 'image' || fileType === 'video')
    ? URL.createObjectURL(file)
    : null;
  const [textPreview, setTextPreview] = useState<string>('');

  useEffect(() => {
    if (fileType === 'text') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setTextPreview(text.slice(0, 100));
      };
      reader.readAsText(file.slice(0, 200));
    }
  }, [file, fileType]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isUploading = status === 'pending' || status === 'uploading';
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed';

  return (
    <div
      className={cn(
        'relative flex items-center gap-2.5 rounded-lg border bg-muted/30 p-1.5 pr-8',
        'max-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-150',
        isFailed && 'border-destructive/50 bg-destructive/5',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
        {fileType === 'image' && previewUrl && (
          <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
        )}

        {fileType === 'video' && previewUrl && (
          <div className="relative h-full w-full">
            <video src={previewUrl} className="h-full w-full object-cover" muted />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="rounded-full bg-white/90 p-1">
                <svg className="h-3 w-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {fileType === 'text' && (
          <div className="flex h-full w-full flex-col items-center justify-center p-0.5">
            <div className="h-full w-full overflow-hidden rounded-sm bg-background/50 p-0.5">
              <div className="text-[5px] leading-tight text-muted-foreground/70 line-clamp-4">
                {textPreview || '...'}
              </div>
            </div>
          </div>
        )}

        {fileType === 'generic' && (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <FileIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[7px] font-medium text-muted-foreground mt-0.5">
              {getFileExtension(file.name)}
            </span>
          </div>
        )}

        {/* Upload status overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
        )}
        {isCompleted && (
          <div className="absolute bottom-0 right-0 rounded-tl bg-emerald-500 p-0.5">
            <Check className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium">{file.name}</p>
        <p className={cn(
          "text-[10px]",
          isFailed ? "text-destructive" : "text-muted-foreground"
        )}>
          {isFailed ? 'Upload failed' : isUploading ? 'Uploading...' : formatFileSize(file.size)}
        </p>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full p-1 transition-colors cursor-pointer hover:bg-muted-foreground/20"
        aria-label="Remove file"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
});

// =============================================================================
// FileUploadList Component
// =============================================================================

interface FileUploadListProps {
  uploads: FileUpload[];
  onRemove: (id: string) => void;
  className?: string;
}

export const FileUploadList = memo(function FileUploadList({
  uploads,
  onRemove,
  className,
}: FileUploadListProps) {
  if (uploads.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {uploads.map(upload => (
        <FileUploadPreview
          key={upload.id}
          upload={upload}
          onRemove={() => onRemove(upload.id)}
        />
      ))}
    </div>
  );
});

// =============================================================================
// Utility Functions
// =============================================================================

export function showFileUploadDialog(accept: string = '*/*'): Promise<File[] | null> {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = accept;
  input.click();

  return new Promise((resolve) => {
    input.onchange = (e) => {
      const files = (e.currentTarget as HTMLInputElement).files;
      if (files) {
        resolve(Array.from(files));
        return;
      }
      resolve(null);
    };
  });
}
