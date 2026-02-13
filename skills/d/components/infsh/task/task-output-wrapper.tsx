'use client';

/**
 * TaskOutputWrapper
 *
 * A self-contained component that fetches and streams a task by ID.
 * Combines useTask hook with TaskOutput for easy drop-in usage.
 *
 * @example
 * ```tsx
 * // With explicit client
 * const client = new Inference({ apiKey: 'your-key' });
 * <TaskOutputWrapper client={client} taskId="abc123" />
 *
 * // Within AgentProvider (client comes from context via useAgentClient)
 * <AgentChatProvider client={client} agentConfig={...}>
 *   <TaskOutputWrapper client={useAgentClient()} taskId="abc123" />
 * </AgentChatProvider>
 * ```
 */

import React, { memo, useCallback } from 'react';
import type { TaskDTO as Task } from '@inferencesh/sdk';
import type { AgentClient } from '@inferencesh/sdk/agent';
import { cn } from '@/lib/utils';
import { useTask } from '@/hooks/use-task';
import { TaskOutput } from '@/components/infsh/task/task-output';

export interface TaskOutputWrapperProps {
  /** The inference client instance (AgentClient compatible) */
  client: AgentClient;
  /** The task ID to display */
  taskId: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode (no card wrapper) */
  compact?: boolean;
  /** Show error details */
  showError?: boolean;
  /** Called when task data updates */
  onUpdate?: (task: Task) => void;
  /** Called when task reaches terminal status */
  onComplete?: (task: Task) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Called when cancel button is clicked */
  onCancel?: (taskId: string) => void;
}

export const TaskOutputWrapper = memo(function TaskOutputWrapper({
  client,
  taskId,
  className,
  compact = false,
  showError = true,
  onUpdate,
  onComplete,
  onError,
  onCancel,
}: TaskOutputWrapperProps) {

  const { task, isLoading, isStreaming } = useTask({
    client,
    taskId,
    onUpdate,
    onComplete,
    onError,
  });

  const handleCancel = useCallback(async () => {
    if (onCancel) {
      onCancel(taskId);
    } else {
      // Default cancel behavior using client.http
      try {
        await client.http.request('post', `/tasks/${taskId}/cancel`);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('Failed to cancel task'));
      }
    }
  }, [client, taskId, onCancel, onError]);

  return (
    <TaskOutput
      task={task}
      isLoading={isLoading}
      isStreaming={isStreaming}
      className={cn(className)}
      compact={compact}
      showError={showError}
      onCancel={handleCancel}
    />
  );
});
