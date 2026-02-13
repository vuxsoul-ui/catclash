import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { ToolInvocation } from '@/components/infsh/agent/tool-invocation';
import type { ChatMessageDTO } from '@inferencesh/sdk/agent';

interface ToolInvocationsProps {
  message: ChatMessageDTO;
  className?: string;
}

/**
 * ToolInvocations - List of tool calls for a message
 * 
 * @example
 * ```tsx
 * <ToolInvocations message={message} />
 * ```
 */
export const ToolInvocations = memo(function ToolInvocations({
  message,
  className,
}: ToolInvocationsProps) {
  const invocations = message.tool_invocations;

  if (!invocations || invocations.length === 0) {
    return null;
  }

  return (
    <div className={cn('mt-2 space-y-1', className)}>
      {invocations.map((invocation, idx) => (
        <ToolInvocation key={invocation.id || idx} invocation={invocation} />
      ))}
    </div>
  );
});

ToolInvocations.displayName = 'ToolInvocations';

