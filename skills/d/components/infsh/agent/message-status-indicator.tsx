import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

// =============================================================================
// Props
// =============================================================================

export interface MessageStatusIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Size of the loader icon */
  size?: number;
  /** Whether to show text label */
  showLabel?: boolean;
  /** Custom label text (defaults to "generating...") */
  label?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * MessageStatusIndicator - Shows when a message is still being generated
 * 
 * Place this at the end of a message to show the assistant is still working.
 * It will automatically hide when the message reaches a terminal status.
 * 
 * @example
 * ```tsx
 * <MessageBubble message={message}>
 *   <MessageContent message={message} />
 *   <ToolInvocations message={message} />
 *   <MessageStatusIndicator message={message} />
 * </MessageBubble>
 * ```
 * 
 * @example With custom styling
 * ```tsx
 * <MessageStatusIndicator 
 *   message={message} 
 *   size={16}
 *   showLabel={false}
 *   className="mt-2"
 * />
 * ```
 */
export const MessageStatusIndicator = memo(function MessageStatusIndicator({
  className,
  size = 18,
  showLabel = true,
  label = 'generating...',
}: MessageStatusIndicatorProps) {

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-muted-foreground py-1',
        className
      )}
    >
      <Spinner className="size-4" style={{ width: size, height: size }} />
      {showLabel && (
        <span className="text-xs opacity-70">{label}</span>
      )}
    </div>
  );
});

MessageStatusIndicator.displayName = 'MessageStatusIndicator';
