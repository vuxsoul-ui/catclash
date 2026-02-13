import React, { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChatContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * ChatContainer - Grid layout wrapper for chat components
 * 
 * @example
 * ```tsx
 * <ChatContainer className="h-screen">
 *   <Header />
 *   <ChatMessages>...</ChatMessages>
 *   <ChatInput />
 * </ChatContainer>
 * ```
 */
export const ChatContainer = forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'grid max-h-full w-full grid-rows-[auto_1fr_auto]',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

ChatContainer.displayName = 'ChatContainer';

