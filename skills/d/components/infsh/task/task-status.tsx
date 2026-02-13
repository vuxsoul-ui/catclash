'use client';

/**
 * Task Status Components
 *
 * Visual components for displaying task status.
 */

import React, { memo } from 'react';
import type { TaskDTO as Task, TaskEvent } from '@inferencesh/sdk';
import {
  TaskStatusReceived,
  TaskStatusQueued,
  TaskStatusScheduled,
  TaskStatusPreparing,
  TaskStatusServing,
  TaskStatusSettingUp,
  TaskStatusRunning,
  TaskStatusUploading,
  TaskStatusCompleted,
  TaskStatusFailed,
  TaskStatusCancelled,
  TaskStatusCancelling,
} from '@inferencesh/sdk';
import { cn } from '@/lib/utils';
import { TimeSince } from './time-since';

type TaskStatus = number;

/** Get CSS classes for status color */
export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case TaskStatusQueued:
      return 'text-yellow-600 bg-yellow-600/15 dark:text-yellow-400 dark:bg-yellow-400/15';
    case TaskStatusScheduled:
      return 'text-orange-600 bg-orange-600/15 dark:text-orange-400 dark:bg-orange-400/15';
    case TaskStatusPreparing:
    case TaskStatusServing:
    case TaskStatusSettingUp:
    case TaskStatusRunning:
      return 'text-purple-600 bg-purple-600/15 dark:text-purple-400 dark:bg-purple-400/15';
    case TaskStatusFailed:
      return 'text-red-600 bg-red-600/15 dark:text-red-400 dark:bg-red-400/15';
    case TaskStatusCompleted:
      return 'text-green-600 bg-green-600/15 dark:text-green-400 dark:bg-green-400/15';
    case TaskStatusCancelled:
    case TaskStatusCancelling:
      return 'text-gray-600 bg-gray-600/15 dark:text-gray-400 dark:bg-gray-400/15';
    default:
      return 'text-muted-foreground bg-muted/15';
  }
}

/** Get status display text */
export function getStatusText(status: TaskStatus): string | null {
  switch (status) {
    case TaskStatusReceived:
      return 'received';
    case TaskStatusQueued:
      return 'queued';
    case TaskStatusScheduled:
      return 'scheduled';
    case TaskStatusPreparing:
      return 'preparing';
    case TaskStatusServing:
      return 'serving';
    case TaskStatusSettingUp:
      return 'setting up';
    case TaskStatusRunning:
      return 'running';
    case TaskStatusUploading:
      return 'uploading';
    case TaskStatusCompleted:
      return null; // Show only time for completed
    case TaskStatusFailed:
      return 'failed';
    case TaskStatusCancelled:
      return 'cancelled';
    case TaskStatusCancelling:
      return 'cancelling';
    default:
      return null;
  }
}

/** Get full status text (always returns text) */
export function getStatusTextFull(status: TaskStatus): string {
  const text = getStatusText(status);
  if (text) return text;
  if (status === TaskStatusCompleted) return 'completed';
  return 'unknown';
}

export interface TaskEventTimes {
  received?: string;
  queued?: string;
  scheduled?: string;
  preparing?: string;
  serving?: string;
  settingUp?: string;
  running?: string;
  uploading?: string;
  completed?: string;
  failed?: string;
  cancelled?: string;
}

/** Extract event times from task events */
export function extractTaskEventTimes(task: Task): TaskEventTimes {
  const findEventTime = (status: TaskStatus) =>
    task.events?.find((e: TaskEvent) => e.status === status)?.event_time;

  return {
    received: findEventTime(TaskStatusReceived),
    queued: findEventTime(TaskStatusQueued),
    scheduled: findEventTime(TaskStatusScheduled),
    preparing: findEventTime(TaskStatusPreparing),
    serving: findEventTime(TaskStatusServing),
    settingUp: findEventTime(TaskStatusSettingUp),
    running: findEventTime(TaskStatusRunning),
    uploading: findEventTime(TaskStatusUploading),
    completed: findEventTime(TaskStatusCompleted),
    failed: findEventTime(TaskStatusFailed),
    cancelled: findEventTime(TaskStatusCancelled),
  };
}

export interface StatusPillProps {
  task: Task;
  isStreaming?: boolean;
  timeOnly?: boolean;
  className?: string;
}

/** Status pill showing task status with optional elapsed time */
export const StatusPill = memo(function StatusPill({
  task,
  isStreaming = false,
  timeOnly = false,
  className,
}: StatusPillProps) {
  if (!task?.status || !task?.events) {
    return null;
  }

  const status = task.status;
  const times = extractTaskEventTimes(task);
  const startTime = times.preparing || times.received;
  const endTime = times.completed || times.failed || times.cancelled;

  return (
    <div
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1',
        getStatusColor(status),
        isStreaming && 'animate-pulse',
        className
      )}
    >
      {!timeOnly && getStatusText(status)}
      <TimeSince start={startTime} end={endTime} parentheses />
    </div>
  );
});

export interface StatusPillSimpleProps {
  status: TaskStatus;
  className?: string;
}

/** Simple status pill without time */
export const StatusPillSimple = memo(function StatusPillSimple({
  status,
  className,
}: StatusPillSimpleProps) {
  return (
    <div
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium',
        getStatusColor(status),
        className
      )}
    >
      {getStatusTextFull(status)}
    </div>
  );
});
