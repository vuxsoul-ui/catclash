'use client';

/**
 * TaskOutput Component
 *
 * Displays task output with status, logs, and output fields.
 * Supports streaming updates for real-time progress.
 */

import React, { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TaskDTO as Task } from '@inferencesh/sdk';
import { TaskStatusCompleted, TaskStatusFailed, TaskStatusCancelled } from '@inferencesh/sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { CircleAlert, XCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusPill } from './task-status';
import { TaskLogs, SimpleLogs } from './task-logs';
import { OutputFields } from './output-fields';

type OutputView = 'output' | 'logs' | 'json';

export interface TaskOutputProps {
  /** The task to display */
  task: Task | null;
  /** Whether the initial fetch is loading */
  isLoading?: boolean;
  /** Whether streaming is active */
  isStreaming?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode (no card wrapper) */
  compact?: boolean;
  /** Show error details */
  showError?: boolean;
  /** Optional cancel handler */
  onCancel?: () => void;
}

/** Check if task status is terminal */
function isTerminalStatus(status: number | undefined): boolean {
  return (
    status !== undefined &&
    [TaskStatusCompleted, TaskStatusFailed, TaskStatusCancelled].includes(status)
  );
}

/** Loading state display */
const LoadingContent = memo(function LoadingContent({
  task,
  compact,
}: {
  task: Task | null;
  compact: boolean;
}) {
  const content = (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Spinner className="h-8 w-8" />
      {task && <SimpleLogs task={task} compact onlyLastLine />}
    </div>
  );

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">{content}</CardContent>
      </Card>
    );
  }

  return content;
});

/** Empty state display */
const EmptyContent = memo(function EmptyContent({ compact }: { compact: boolean }) {
  const content = (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/20" />
      <span className="text-sm text-muted-foreground/50 mt-4">no output yet</span>
    </div>
  );

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">{content}</CardContent>
      </Card>
    );
  }

  return content;
});

/** Error state display */
const ErrorContent = memo(function ErrorContent({
  error,
  compact,
}: {
  error: string | null;
  compact: boolean;
}) {
  const content = (
    <div className={cn('rounded-lg', !compact && 'border border-muted p-4')}>
      <div className="flex items-start gap-3">
        <CircleAlert className="w-5 h-5 text-red-500/50 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground">task error</h3>
          {error && (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-all">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">{content}</CardContent>
      </Card>
    );
  }

  return content;
});

/** Cancelled state display */
const CancelledContent = memo(function CancelledContent({
  message,
  compact,
}: {
  message: string;
  compact: boolean;
}) {
  const content = (
    <div className={cn('rounded-lg', !compact && 'border border-muted p-4')}>
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground">task cancelled</h3>
          {message && (
            <p className="mt-2 text-sm text-foreground whitespace-pre-wrap break-all">{message}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">{content}</CardContent>
      </Card>
    );
  }

  return content;
});

/** Output view toggle */
const OutputToggle = memo(function OutputToggle({
  output,
  setOutput,
  hasOutput,
}: {
  output: OutputView;
  setOutput: (o: OutputView) => void;
  hasOutput: boolean;
}) {
  const views: { key: OutputView; label: string; show: boolean }[] = [
    { key: 'output', label: 'output', show: true },
    { key: 'logs', label: 'logs', show: true },
    { key: 'json', label: 'json', show: hasOutput },
  ];

  return (
    <div className="inline-flex border rounded-full gap-0.5 overflow-hidden p-0.5">
      {views.filter(v => v.show).map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setOutput(key)}
          className={cn(
            'rounded-full px-2.5 py-0.5 h-6 text-xs cursor-pointer transition-colors',
            output === key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
});

/** Header section with status and controls */
const HeaderSection = memo(function HeaderSection({
  task,
  output,
  setOutput,
  isStreaming,
  onCancel,
}: {
  task: Task | null;
  output: OutputView;
  setOutput: (o: OutputView) => void;
  isStreaming: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex flex-row gap-2">
        {task && <OutputToggle output={output} setOutput={setOutput} hasOutput={!!task.output} />}
      </div>
      <div className="flex flex-row items-center gap-2">
        {task?.status !== undefined && (
          <>
            <StatusPill task={task} isStreaming={isStreaming} />
            {!isTerminalStatus(task.status) && onCancel && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 p-0 flex items-center justify-center border border-red-500/30 hover:border-red-500/50 rounded-full hover:bg-red-500/20"
                onClick={onCancel}
              >
                <XCircle className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
});

/** JSON output view */
const JsonContent = memo(function JsonContent({ task }: { task: Task }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(task.output, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className='p-0 gap-0'>
      <CardContent className="p-4 relative group">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <div className="overflow-auto max-w-full max-h-[500px]">
          <pre className="whitespace-pre-wrap break-all text-xs font-mono">
            {task.output ? JSON.stringify(task.output, null, 2) : '{}'}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
});

/** Output content - renders task output fields */
const OutputContent = memo(function OutputContent({ task }: { task: Task }) {
  const output = task.output;

  if (!output || typeof output !== 'object') {
    return (
      <div className="text-sm text-muted-foreground">
        {output !== undefined ? String(output) : 'no output'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isTerminalStatus(task.status) && (
        <div className="flex justify-end">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      <OutputFields output={output as Record<string, unknown>} />
    </div>
  );
});

/** Main TaskOutput component */
export const TaskOutput = memo(function TaskOutput({
  task,
  isLoading = false,
  isStreaming = false,
  className,
  compact = false,
  showError = true,
  onCancel,
}: TaskOutputProps) {
  const [output, setOutput] = useState<OutputView>('output');

  let content = null;

  if (isLoading && !task) {
    content = <LoadingContent task={null} compact={compact} />;
  } else if (!task) {
    content = <EmptyContent compact={compact} />;
  } else if (output === 'logs') {
    content = <TaskLogs task={task} />;
  } else if (output === 'json') {
    content = <JsonContent task={task} />;
  } else if (task.output) {
    content = <OutputContent task={task} />;
  } else if (task.status === TaskStatusFailed) {
    content = <ErrorContent error={showError ? task.error : null} compact={compact} />;
  } else if (task.status === TaskStatusCancelled) {
    content = <CancelledContent message={task.error} compact={compact} />;
  } else {
    content = <LoadingContent task={task} compact={compact} />;
  }

  if (compact) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className={className}>
      <Card className="gap-2 p-2">
        {task && (
          <CardHeader className="p-0">
            <CardTitle>
              <HeaderSection
                task={task}
                output={output}
                setOutput={setOutput}
                isStreaming={isStreaming}
                onCancel={onCancel}
              />
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-0">{content}</CardContent>
      </Card>
    </div>
  );
});
