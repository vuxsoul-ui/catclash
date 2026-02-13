export { TaskOutput } from './task-output';
export type { TaskOutputProps } from './task-output';

// Hook
export { useTask, isTerminalStatus } from '@/hooks/use-task';
export type { UseTaskOptions, UseTaskResult } from '@/hooks/use-task';

// Status components
export {
  StatusPill,
  StatusPillSimple,
  getStatusColor,
  getStatusText,
  getStatusTextFull,
  extractTaskEventTimes,
} from './task-status';
export type { StatusPillProps, StatusPillSimpleProps, TaskEventTimes } from './task-status';

// Logs components
export { TaskLogs, SimpleLogs, LogViewer } from './task-logs';
export type { TaskLogsProps, SimpleLogsProps } from './task-logs';

// Output fields components
export { OutputField, OutputFields, isFile, isUrl } from './output-fields';
export type { OutputFieldProps, OutputFieldsProps, Field } from './output-fields';

// File preview component
export { FilePreview } from './file-preview';
export type { FilePreviewProps, PartialFile } from './file-preview';

// Time component
export { TimeSince } from './time-since';
export type { TimeSinceProps } from './time-since';

// Wrapper component for easy integration
export { TaskOutputWrapper } from './task-output-wrapper';
export type { TaskOutputWrapperProps } from './task-output-wrapper';
