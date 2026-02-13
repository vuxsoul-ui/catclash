import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowUp, Square, ImagePlus, Paperclip, File as FileIcon, AlertCircle, X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAgentChat, useAgentActions } from '@inferencesh/sdk/agent';
import {
  useFileUploadManager,
  FileUploadList,
  showFileUploadDialog,
  type FileUpload,
} from '@/components/infsh/agent/file-upload';

interface ChatInputProps {
  placeholder?: string;
  className?: string;
  allowAttachments?: boolean;
  allowFiles?: boolean;
  allowImages?: boolean;
  onFilesChange?: (files: File[]) => void;
}

// =============================================================================
// Drag Overlay Component (CSS transitions)
// =============================================================================

interface DragOverlayProps {
  isDragging: boolean;
}

const DragOverlay = memo(function DragOverlay({ isDragging }: DragOverlayProps) {
  if (!isDragging) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 animate-in fade-in duration-150"
    >
      <div className="flex flex-col items-center gap-2 text-primary">
        <Paperclip className="h-6 w-6" />
        <span className="text-sm font-medium">drop files to upload</span>
      </div>
    </div>
  );
});

// =============================================================================
// ChatInput Component
// =============================================================================

/**
 * ChatInput - Self-contained input with file upload and auto-resize
 *
 * @example
 * ```tsx
 * <ChatInput placeholder="Ask me anything..." allowAttachments />
 * ```
 */
export const ChatInput = memo(function ChatInput({
  placeholder = 'ask a question...',
  className,
  allowAttachments,
  allowFiles = true,
  allowImages = true,
}: ChatInputProps) {
  // Backwards compatibility: if allowAttachments is explicitly false, disable both
  const showFileButton = allowAttachments !== false && allowFiles;
  const showImageButton = allowAttachments !== false && allowImages;
  const enableAttachments = showFileButton || showImageButton;
  const { isGenerating, error } = useAgentChat();
  const { sendMessage, stopGeneration, clearError } = useAgentActions();

  const [value, setValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  // File upload manager - uploads files on select
  const {
    uploads,
    addFiles,
    removeUpload,
    clearAll,
    getUploadedFiles,
    hasPendingUploads,
    hasCompletedUploads,
  } = useFileUploadManager();

  const completedUploads = uploads.filter(u => u.status === 'completed');

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  // Add @filename reference to text
  const addFileReferenceToText = useCallback((upload: FileUpload) => {
    const fileName = upload.file.name;
    const text = `@${fileName} `;
    setValue(prev => {
      const needsSpace = prev && !prev.endsWith(' ');
      return `${prev}${needsSpace ? ' ' : ''}${text}`;
    });

    // Focus textarea and move cursor to end
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          const length = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(length, length);
        }
      }, 0);
    }
  }, []);

  // Handle send
  const handleSend = useCallback(async () => {
    const messageText = value.trim();

    // Need either text or completed uploads
    if (!messageText && !hasCompletedUploads) return;

    // Don't send while uploads are in progress
    if (hasPendingUploads) return;

    if (isGenerating) return;

    // Get already-uploaded files
    const uploadedFiles = getUploadedFiles();

    setValue('');
    clearAll();

    // Send message with pre-uploaded files
    await sendMessage(messageText, uploadedFiles.length > 0 ? uploadedFiles : undefined);
  }, [value, hasCompletedUploads, hasPendingUploads, isGenerating, getUploadedFiles, clearAll, sendMessage]);

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Show command menu when @ is typed (and we have completed uploads)
      if (e.key === '@' && completedUploads.length > 0) {
        e.preventDefault();
        setShowCommandMenu(true);
      }

      // Hide command menu on Escape
      if (e.key === 'Escape') {
        setShowCommandMenu(false);
      }

      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, completedUploads.length]
  );

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!enableAttachments) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }

    if (files.length > 0) {
      addFiles(files);
    }
  }, [enableAttachments, addFiles]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (!enableAttachments) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [enableAttachments, addFiles]);

  // Handle attachment button click
  const handleAttachmentClick = async () => {
    const files = await showFileUploadDialog();
    if (files) {
      addFiles(files);
    }
  };

  // Handle image button click
  const handleImageClick = async () => {
    const files = await showFileUploadDialog('image/*');
    if (files) {
      addFiles(files);
    }
  };

  const canSend = (value.trim().length > 0 || hasCompletedUploads) && !isGenerating && !hasPendingUploads;

  return (
    <div className="relative">
      {/* Error notification - floats above input */}
      {error && (
        <div className="absolute -top-10 left-0 right-0 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">failed to send: {error}</span>
            <button
              onClick={clearError}
              className="shrink-0 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          'relative flex w-full flex-col gap-2 rounded-2xl border bg-muted/30 p-3',
          isDragging && 'ring-2 ring-primary/50',
          className
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* File uploads */}
      {uploads.length > 0 && (
        <FileUploadList
          uploads={uploads}
          onRemove={removeUpload}
          className="pb-2"
        />
      )}

      {/* Text area with @ file reference popover */}
      <div className="relative">
        <Popover open={showCommandMenu} onOpenChange={setShowCommandMenu}>
          {/* Hidden trigger for popover positioning */}
          <PopoverTrigger asChild>
            <div className="w-0 h-0 absolute" />
          </PopoverTrigger>
          <PopoverContent className="p-0 w-64" align="start" side="top" sideOffset={8}>
            <Command className="rounded-lg border-none">
              <CommandInput placeholder="search files..." />
              <CommandList>
                <CommandEmpty>no files uploaded.</CommandEmpty>
                {completedUploads.length > 0 && (
                  <CommandGroup heading="Files">
                    {completedUploads.map((upload) => (
                      <CommandItem
                        key={upload.id}
                        onSelect={() => {
                          addFileReferenceToText(upload);
                          setShowCommandMenu(false);
                        }}
                        className="cursor-pointer"
                      >
                        <FileIcon className="mr-2 h-4 w-4" />
                        <span className="truncate">{upload.file.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent text-sm',
            'placeholder:text-muted-foreground/50',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'min-h-[24px] max-h-[200px]'
          )}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Left side - action buttons */}
        <div className="flex items-center gap-1">
          {showFileButton && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleAttachmentClick}
              disabled={isGenerating}
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          )}
          {showImageButton && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleImageClick}
              disabled={isGenerating}
              aria-label="Attach image"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Right side - send/stop button */}
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <Button
              type="button"
              size="icon"
              variant="default"
              onClick={stopGeneration}
              className="h-8 w-8 rounded-full cursor-pointer"
              aria-label="Stop generating"
            >
              <Square className="h-3 w-3" fill="currentColor" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="h-8 w-8 rounded-full cursor-pointer"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

        {/* Drag overlay */}
        <DragOverlay isDragging={isDragging} />
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
