import React, { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronRight, MessageCircleDashed } from 'lucide-react';

interface MessageReasoningProps {
  reasoning: string;
  isReasoning?: boolean;
  className?: string;
}

/**
 * MessageReasoning - Collapsible reasoning block
 * 
 * @example
 * ```tsx
 * <MessageReasoning reasoning={reasoningText} isReasoning={true} />
 * ```
 */
export const MessageReasoning = memo(function MessageReasoning({
  reasoning,
  isReasoning = false,
  className,
}: MessageReasoningProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoning.trim()) return null;

  // Get the last line of reasoning for preview
  const getLastLine = () => {
    const lines = reasoning.trim().split('\n').filter((line) => line.trim().length > 0);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.length > 50) {
        return line.length > 60 ? line.slice(0, 60) + '...' : line;
      }
    }
    return null;
  };

  const label = isReasoning ? 'thinking' : 'thought';
  const preview =
    isReasoning && getLastLine() ? (
      <span className="text-xs text-muted-foreground/40 truncate max-w-[300px] lowercase ml-2">
        - {getLastLine()}
      </span>
    ) : null;

  return (
    <div className={cn('flex flex-col items-start w-fit mb-2', className)}>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn(
          'group w-full overflow-hidden rounded-lg text-muted-foreground',
          isOpen && 'border bg-muted/10'
        )}
      >
        <div className="flex items-center p-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-muted-foreground/50 hover:text-muted-foreground cursor-pointer">
              {isOpen ? (
                <ChevronRight className="h-4 w-4 rotate-90 transition-transform" />
              ) : (
                <MessageCircleDashed className="h-4 w-4" />
              )}
              <span className={cn('relative text-sm', isReasoning && 'animate-pulse')}>
                {label}
              </span>
              {!isOpen && preview}
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="border-t p-2">
            <div className="whitespace-pre-wrap text-xs max-h-[200px] overflow-y-auto">
              <MarkdownRenderer content={reasoning} compact={true} />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});

MessageReasoning.displayName = 'MessageReasoning';

