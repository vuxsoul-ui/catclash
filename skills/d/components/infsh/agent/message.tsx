import React, { memo } from 'react';
import {
  ChatMessageRoleUser,
  ChatMessageRoleAssistant,
  ChatMessageContentTypeReasoning,
  ChatMessageContentTypeText,
  ChatMessageStatusReady,
  ChatMessageStatusFailed,
  ChatMessageStatusCancelled,
} from '@inferencesh/sdk';
import type { ChatMessageDTO } from '@inferencesh/sdk/agent';
import { MessageBubble } from '@/components/infsh/agent/message-bubble';
import { MessageContent } from '@/components/infsh/agent/message-content';
import { MessageReasoning } from '@/components/infsh/agent/message-reasoning';
import { ToolInvocations } from '@/components/infsh/agent/tool-invocations';

function isTerminalChatMessageStatus(status: string | undefined): boolean {
  return status === ChatMessageStatusReady ||
    status === ChatMessageStatusFailed ||
    status === ChatMessageStatusCancelled;
}

export interface MessageProps {
  message: ChatMessageDTO;
  /** Truncate user messages */
  truncateUser?: boolean;
}

/**
 * Default message rendering with all features:
 * - Reasoning block (collapsed, for assistant)
 * - Text content
 * - Tool invocations (for assistant)
 */
export const Message = memo(function Message({
  message,
  truncateUser = false,
}: MessageProps) {
  const isUser = message.role === ChatMessageRoleUser;
  const isAssistant = message.role === ChatMessageRoleAssistant;

  // Skip tool messages
  if (message.role === 'tool') return null;

  const reasoningContent = message.content?.find(
    c => c.type === ChatMessageContentTypeReasoning
  )?.text;

  const hasText = message.content?.some(
    c => c.type === ChatMessageContentTypeText && c.text?.trim()
  );

  const hasTools = message.tool_invocations && message.tool_invocations.length > 0;

  // Skip empty messages (no text, no reasoning, no tools)
  if (!hasText && !reasoningContent && !hasTools) return null;

  const isGenerating = !isTerminalChatMessageStatus(message.status);

  return (
    <MessageBubble message={message}>
      {isAssistant && reasoningContent && (
        <MessageReasoning
          reasoning={reasoningContent}
          isReasoning={isGenerating && !hasText}
        />
      )}
      <MessageContent message={message} truncate={isUser && truncateUser} />
      {isAssistant && <ToolInvocations message={message} />}
    </MessageBubble>
  );
});

