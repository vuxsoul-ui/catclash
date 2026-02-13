'use client';

/**
 * FilePreview Component
 *
 * Renders file previews based on content type: images, videos, audio, text, and generic files.
 * Supports zoomable images, copy URL, open in new tab, and download actions.
 */

import { Button } from '@/components/ui/button';
import { DownloadIcon, ExternalLinkIcon, FileIcon, LinkIcon, Copy, Check } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Partial file structure from SDK */
export interface PartialFile {
  uri: string;
  path?: string;
  filename?: string;
  content_type?: string;
  size?: number;
}

export interface FilePreviewProps {
  file: PartialFile;
  index?: number;
  onLoad?: () => void;
  onError?: () => void;
  /** Show action buttons on hover */
  buttons?: boolean;
  /** Allow clicking to interact */
  clickable?: boolean;
  /** Auto-play videos */
  autoplay?: boolean;
  /** Object fit mode */
  objectFit?: 'contain' | 'cover';
  /** Show card border */
  card?: boolean;
  /** Allow dragging */
  draggable?: boolean;
  className?: string;
}

/** Guess content type from URL extension */
function guessContentType(uri: string): string | null {
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0];
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    // Text
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    // Documents
    pdf: 'application/pdf',
  };
  return ext ? mimeTypes[ext] || null : null;
}

/** Get friendly type name from MIME type */
function getFriendlyType(mime: string | undefined): string | null {
  if (!mime) return null;

  const friendlyNames: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/json': 'JSON',
    'text/plain': 'Text',
    'text/markdown': 'Markdown',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/svg+xml': 'SVG',
    'video/mp4': 'MP4',
    'video/webm': 'WebM',
    'audio/mpeg': 'MP3',
    'audio/wav': 'WAV',
  };

  if (friendlyNames[mime]) return friendlyNames[mime];

  // Fallback: extract subtype
  const parts = mime.split('/');
  if (parts.length === 2) {
    let subtype = parts[1].replace(/^x-/, '').replace(/^vnd\./, '').split('.')[0];
    return subtype.charAt(0).toUpperCase() + subtype.slice(1);
  }
  return null;
}

/** Get content category for rendering */
function getContentCategory(
  contentType: string | undefined,
  uri: string
): 'image' | 'video' | 'audio' | 'text' | 'file' {
  if (contentType?.startsWith('image/')) return 'image';
  if (contentType?.startsWith('video/')) return 'video';
  if (contentType?.startsWith('audio/')) return 'audio';
  if (contentType === 'text/plain' || contentType === 'text/markdown') return 'text';
  return 'file';
}

export function FilePreview({
  file,
  index,
  onLoad,
  onError,
  buttons = true,
  clickable = true,
  autoplay = false,
  objectFit = 'contain',
  card = true,
  draggable = true,
  className,
}: FilePreviewProps) {
  const [contentType, setContentType] = useState(file.content_type);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!file.content_type) {
      const guessed = guessContentType(file.uri);
      if (guessed) {
        setContentType(guessed);
      }
    }
  }, [file.content_type, file.uri]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!draggable) return;
      e.dataTransfer.setData('text/uri-list', file.uri);
      e.dataTransfer.setData('text/plain', file.uri);
      e.dataTransfer.effectAllowed = 'copyMove';
    },
    [draggable, file.uri]
  );

  const handleCopyUrl = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(file.uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [file.uri]
  );

  const handleOpenExternal = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(file.uri, '_blank');
    },
    [file.uri]
  );

  const category = getContentCategory(contentType, file.uri);

  const renderContent = () => {
    switch (category) {
      case 'image':
        return (
          <img
            src={file.uri}
            alt={file.filename || 'Image'}
            className={cn(
              'rounded-md w-full h-full',
              objectFit === 'cover' ? 'object-cover' : 'object-contain'
            )}
            onLoad={onLoad}
            onError={() => onError?.()}
          />
        );

      case 'video':
        return (
          <video
            controls={!autoplay && clickable}
            autoPlay={autoplay}
            preload="auto"
            loop={autoplay}
            muted={autoplay}
            playsInline={autoplay}
            className={cn(
              'rounded-md w-full h-full',
              objectFit === 'cover' ? 'object-cover' : 'object-contain'
            )}
            onLoadedData={onLoad}
            onError={() => onError?.()}
          >
            <source src={file.uri} type={contentType || undefined} />
            Your browser does not support the video tag.
          </video>
        );

      case 'audio':
        return (
          <div className="flex items-center justify-center p-4 w-full">
            <audio controls className="w-full max-w-md" onLoadedData={onLoad} onError={() => onError?.()}>
              <source src={file.uri} type={contentType || undefined} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );

      case 'text':
        return (
          <div className="p-4 font-mono text-xs whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto text-muted-foreground">
            <TextPreview url={file.uri} onLoad={onLoad} onError={onError} />
          </div>
        );

      case 'file':
      default:
        const friendlyType = getFriendlyType(contentType);
        return (
          <div
            className="flex flex-col items-center justify-center gap-2 p-4 w-full h-full min-h-[120px] text-xs text-muted-foreground cursor-pointer hover:bg-muted/10 transition-colors"
            onClick={handleOpenExternal}
          >
            <FileIcon className="h-8 w-8 text-muted-foreground" />
            <span className="text-foreground font-mono text-center truncate max-w-full px-2">
              {file.filename || 'Unknown file'}
            </span>
            {friendlyType && <span className="text-muted-foreground/60 text-[10px]">{friendlyType}</span>}
          </div>
        );
    }
  };

  return (
    <div
      key={file.uri || index}
      className={cn(
        'relative w-full h-full group overflow-hidden',
        card && 'border rounded-xl bg-background',
        draggable && 'cursor-grab active:cursor-grabbing',
        className
      )}
      draggable={draggable}
      onDragStart={handleDragStart}
    >
      {renderContent()}
      {buttons && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            onClick={handleCopyUrl}
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Copy URL"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <LinkIcon className="h-3 w-3" />}
          </Button>
          <Button
            onClick={handleOpenExternal}
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Open in new tab"
          >
            <ExternalLinkIcon className="h-3 w-3" />
          </Button>
          <Button
            onClick={handleOpenExternal}
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="Download"
          >
            <DownloadIcon className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Simple text preview that fetches and displays text content */
function TextPreview({
  url,
  onLoad,
  onError,
}: {
  url: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        onLoad?.();
      })
      .catch((err) => {
        setError(err.message);
        onError?.();
      });
  }, [url, onLoad, onError]);

  if (error) return <span className="text-red-500">Failed to load: {error}</span>;
  if (content === null) return <span className="text-muted-foreground/50">Loading...</span>;
  return <>{content}</>;
}
