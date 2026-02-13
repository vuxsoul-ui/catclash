import React, { memo, useState, useLayoutEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAutoScroll } from '@/hooks/use-auto-scroll';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { useAgentChat, type ChatMessageDTO } from '@inferencesh/sdk/agent';

interface ChatMessagesProps {
  children: (props: { messages: ChatMessageDTO[] }) => ReactNode;
  className?: string;
  scrollToTopPadding?: boolean;
}

/**
 * ChatMessages - Scrollable message container with render prop
 * 
 * @example
 * ```tsx
 * <ChatMessages>
 *   {({ messages }) => (
 *     <div className="space-y-4">
 *       {messages.map(msg => (
 *         <MessageBubble key={msg.id} message={msg}>
 *           <MessageContent message={msg} />
 *         </MessageBubble>
 *       ))}
 *     </div>
 *   )}
 * </ChatMessages>
 * ```
 * 
 * @example With scroll-to-top padding (allows first message to scroll to top)
 * ```tsx
 * <ChatMessages scrollToTopPadding>
 *   {({ messages }) => <MessageList messages={messages} />}
 * </ChatMessages>
 * ```
 */
export const ChatMessages = memo(function ChatMessages({
  children,
  className,
  scrollToTopPadding = false,
}: ChatMessagesProps) {
  const { messages } = useAgentChat();
  const [spacerHeight, setSpacerHeight] = useState(0);

  const {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  } = useAutoScroll([messages]);

  // Measure container height for the scroll-to-top spacer
  useLayoutEffect(() => {
    if (!scrollToTopPadding || !containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) {
        setSpacerHeight(containerRef.current.clientHeight * 0.9);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [scrollToTopPadding, containerRef]);

  return (
    <div className={cn('flex flex-col min-h-0 min-w-0 relative', className)}>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto min-w-0"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
      >
        {children({ messages })}
        {scrollToTopPadding && messages.length > 0 && (
          <div aria-hidden="true" className="shrink-0" style={{ minHeight: spacerHeight }} />
        )}
      </div>

      {/* Scroll to bottom button */}
      {!shouldAutoScroll && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            onClick={scrollToBottom}
            size="sm"
            variant="default"
            className="bg-background hover:bg-muted text-foreground hover:text-foreground rounded-full shadow-md animate-in fade-in-0 slide-in-from-bottom-2 cursor-pointer"
          >
            <ArrowDown className="h-4 w-4" />
            <span className="text-xs font-normal text-muted-foreground">scroll to bottom</span>
          </Button>
        </div>
      )}
    </div>
  );
});

ChatMessages.displayName = 'ChatMessages';

