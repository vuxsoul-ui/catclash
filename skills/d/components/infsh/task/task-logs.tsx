'use client';

/**
 * Task Logs Components
 *
 * Display task logs with auto-scroll and copy functionality.
 */

import React, { memo, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import type { TaskDTO as Task, TaskLog } from '@inferencesh/sdk';
import {
  TaskLogTypeRun,
  TaskLogTypeServe,
  TaskLogTypeSetup,
  TaskLogTypeTask,
} from '@inferencesh/sdk';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Copy } from 'lucide-react';

type TaskLogType = number;

// Base64 encoding/decoding utilities
function utf8ToBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

function base64ToUtf8(str: string): string {
  try {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(str), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return str;
  }
}

const LOG_TYPES = [
  { key: TaskLogTypeRun, title: 'run' },
  { key: TaskLogTypeServe, title: 'serve' },
  { key: TaskLogTypeSetup, title: 'setup' },
  { key: TaskLogTypeTask, title: 'inference' },
] as const;

function getTaskLogs(task: Task): Record<TaskLogType, TaskLog | undefined> {
  return {
    [TaskLogTypeRun]: task.logs?.find((log: TaskLog) => log.log_type === TaskLogTypeRun),
    [TaskLogTypeServe]: task.logs?.find((log: TaskLog) => log.log_type === TaskLogTypeServe),
    [TaskLogTypeSetup]: task.logs?.find((log: TaskLog) => log.log_type === TaskLogTypeSetup),
    [TaskLogTypeTask]: task.logs?.find((log: TaskLog) => log.log_type === TaskLogTypeTask),
  };
}

function getMergedLogsContent(
  logs: Record<TaskLogType, TaskLog | undefined>,
  onlyLastLine = false
): string {
  let mergedContent = '';

  for (const { key, title } of LOG_TYPES) {
    const log = logs[key];
    if (log?.content) {
      let decodedContent = onlyLastLine ? '' : '--- ' + title + ' ---\n';
      decodedContent += base64ToUtf8(log.content);

      if (decodedContent) {
        mergedContent += '\n' + decodedContent;
      }
    }
  }

  if (onlyLastLine) {
    const lines = mergedContent.split('\n').filter((line) => line.trim());
    return lines.length > 0 ? lines[lines.length - 1] : '';
  }

  return mergedContent.trim();
}

function getHighestAvailableLogType(
  logs: Record<TaskLogType, TaskLog | undefined>
): TaskLogType {
  return LOG_TYPES.reduce((highest, current) => {
    return logs[current.key] && current.key > highest ? current.key : highest;
  }, TaskLogTypeRun);
}

export interface TaskLogsProps {
  task: Task;
  className?: string;
}

/** Full task logs with tabs for different log types */
export const TaskLogs = memo(function TaskLogs({ task, className }: TaskLogsProps) {
  const logs = useMemo(() => getTaskLogs(task), [task]);
  const [selectedTab, setSelectedTab] = useState<TaskLogType>(() =>
    getHighestAvailableLogType(logs)
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (logs) {
      // If current selection is not available, find the next available log
      if (!logs[selectedTab]) {
        const availableLogs = LOG_TYPES.filter((type) => logs[type.key] !== undefined);
        if (availableLogs.length > 0) {
          const currentIndex = LOG_TYPES.findIndex((type) => type.key === selectedTab);
          const nextAvailable = LOG_TYPES.slice(currentIndex + 1).find(
            (type) => logs[type.key] !== undefined
          );
          const logToSelect = nextAvailable?.key || availableLogs[0].key;
          setSelectedTab(logToSelect);
        }
      }
    }
  }, [logs, selectedTab]);

  const handleCopy = async () => {
    const content = logs[selectedTab];
    let textToCopy = '';

    if (content?.content) {
      textToCopy = base64ToUtf8(content.content);
    }

    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className={cn('', className)}>
      <div className="flex overflow-x-auto border-b">
        {LOG_TYPES.map(({ key, title }) =>
          !logs[key] ? (
            <TooltipProvider key={key}>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'px-4 py-2 text-sm font-medium whitespace-nowrap',
                      'hover:bg-muted/50 text-muted-foreground cursor-not-allowed',
                      selectedTab === key && 'border-b-2 border-primary'
                    )}
                  >
                    {title}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>n/a</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              key={key}
              className={cn(
                'px-4 py-2 text-sm font-medium whitespace-nowrap',
                'hover:bg-muted/50 cursor-pointer',
                selectedTab === key && 'border-b-2 border-primary'
              )}
              onClick={() => setSelectedTab(key)}
            >
              {title}
            </button>
          )
        )}
      </div>
      <div className="relative group">
        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCopy}
                  aria-label="Copy logs"
                  disabled={logs[selectedTab] === undefined}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>{copied ? 'copied!' : 'copy logs'}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {logs[selectedTab] && <LogViewer key={selectedTab} content={logs[selectedTab].content} />}
      </div>
    </div>
  );
});

export interface SimpleLogsProps {
  task: Task;
  className?: string;
  compact?: boolean;
  onlyLastLine?: boolean;
}

/** Simple merged logs view */
export const SimpleLogs = memo(function SimpleLogs({
  task,
  className,
  compact = false,
  onlyLastLine = false,
}: SimpleLogsProps) {
  const [copied, setCopied] = useState(false);
  const logs = useMemo(() => getTaskLogs(task), [task]);

  const handleCopy = async () => {
    const mergedContent = getMergedLogsContent(logs, onlyLastLine);

    if (mergedContent) {
      await navigator.clipboard.writeText(mergedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const hasAnyLogs = task.logs && task.logs.length > 0;
  const mergedContent = getMergedLogsContent(logs, onlyLastLine);
  const combinedLogsContent = utf8ToBase64(mergedContent);

  if (compact) {
    return (
      <div className="relative">
        <pre className="font-mono text-xs text-center text-muted-foreground/50 max-w-[500px] whitespace-pre-wrap overflow-hidden truncate max-h-[1.5em] line-clamp-1 break-all">
          {mergedContent.split('\n').map((line: string, i: number) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))}
        </pre>
      </div>
    );
  }

  if (!hasAnyLogs) return null;

  return (
    <div className={cn('', className)}>
      <div className="relative group">
        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={handleCopy} aria-label="Copy logs">
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span>{copied ? 'copied!' : 'copy logs'}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <LogViewer content={combinedLogsContent} />
      </div>
    </div>
  );
});

interface LogViewerProps {
  content: string;
}

/** Base log viewer with auto-scroll */
export const LogViewer = memo(function LogViewer({ content }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const contentRef = useRef(content);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    if (container.scrollHeight === 0) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 10);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 10;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setAutoScroll(distanceFromBottom <= threshold);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || content === contentRef.current) return;

    contentRef.current = content;

    if (autoScroll) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [content, autoScroll]);

  let decodedContent = '';
  try {
    decodedContent = decodeURIComponent(escape(atob(content)));
  } catch {
    decodedContent = content;
  }

  const lines = decodedContent.split('\n');

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="max-h-[400px] bg-muted/50 rounded-lg text-[12px] p-4 overflow-y-auto"
      >
        <pre className="block p-0 m-0 leading-tight font-mono" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}>
          {lines.map((line: string, i: number) => (
            <div key={i} className="flex m-0 p-0">
              <span className="flex-none w-10 text-muted-foreground/30 select-none">{i + 1}</span>
              <span className="flex-1 whitespace-pre text-muted-foreground">
                {line}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
});
