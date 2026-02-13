import React, { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Inference,
  ChatMessageStatusReady,
  ChatMessageStatusFailed,
  ChatMessageStatusCancelled,
  ChatMessageRoleUser,
  ChatMessageRoleAssistant,
  ChatMessageContentTypeReasoning,
  ChatMessageContentTypeText,
} from '@inferencesh/sdk';
import {
  AgentChatProvider,
  useAgentChat,
  useAgentActions,
  isAdHocConfig,
  type ChatMessageDTO,
  type AgentOptions,
} from '@inferencesh/sdk/agent';
import { ChatContainer } from '@/components/infsh/agent/chat-container';
import { ChatMessages } from '@/components/infsh/agent/chat-messages';
import { ChatInput } from '@/components/infsh/agent/chat-input';
import { MessageBubble } from '@/components/infsh/agent/message-bubble';
import { MessageContent } from '@/components/infsh/agent/message-content';
import { MessageReasoning } from '@/components/infsh/agent/message-reasoning';
import { MessageStatusIndicator } from '@/components/infsh/agent/message-status-indicator';
import { ToolInvocations } from '@/components/infsh/agent/tool-invocations';

// Component props
interface AgentProps {
  proxyUrl?: string;
  apiKey?: string;
  baseUrl?: string;
  config: AgentOptions;
  name?: string;
  chatId?: string;
  className?: string;
  compact?: boolean;
  allowFiles?: boolean;
  allowImages?: boolean;
  onChatCreated?: (chatId: string) => void;
  description?: string;
  examplePrompts?: string[];
}

// Check if message status is terminal (generation complete)
function isTerminalStatus(status: string | undefined): boolean {
  return status === ChatMessageStatusReady ||
    status === ChatMessageStatusFailed ||
    status === ChatMessageStatusCancelled;
}

// =============================================================================
// Helper functions
// =============================================================================

function getTextContent(message: ChatMessageDTO): string {
  const textContent = message.content.find((c) => c.type === ChatMessageContentTypeText);
  return textContent?.text ?? '';
}

function getReasoningContent(message: ChatMessageDTO): string | undefined {
  const reasoningContent = message.content.find((c) => c.type === ChatMessageContentTypeReasoning);
  return reasoningContent?.text;
}

function hasTextContent(message: ChatMessageDTO): boolean {
  return message.content.some((c) => c.type === ChatMessageContentTypeText && c.text?.trim());
}

// =============================================================================
// Internal Components
// =============================================================================

const DefaultHeader = memo(function DefaultHeader() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b">
      <Bot className="h-4 w-4 text-primary" />
      <span className="font-medium text-sm">agent</span>
    </div>
  );
});

const ExamplePrompts = memo(function ExamplePrompts({
  prompts,
  onSelect,
}: {
  prompts: string[];
  onSelect: (prompt: string) => void;
}) {
  if (prompts.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 w-full max-w-md">
      {prompts.map((prompt, idx) => (
        <Button
          key={idx}
          variant="outline"
          onClick={() => onSelect(prompt)}
          className="w-full text-left justify-start h-auto py-2 px-3 text-sm whitespace-normal"
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
});

const EmptyState = memo(function EmptyState({
  description,
  examplePrompts = [],
}: {
  description?: string;
  examplePrompts?: string[];
}) {
  const { sendMessage } = useAgentActions();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
      <Bot className="h-8 w-8 mb-3 opacity-50" />
      <p className="text-sm font-medium">how can I help?</p>
      <p className="text-xs mt-1 opacity-70">
        {description || 'ask me anything'}
      </p>
      {examplePrompts.length > 0 && (
        <ExamplePrompts prompts={examplePrompts} onSelect={sendMessage} />
      )}
    </div>
  );
});

const MessageRow = memo(function MessageRow({
  message,
  isLast,
}: {
  message: ChatMessageDTO;
  isLast: boolean;
}) {
  const isUser = message.role === ChatMessageRoleUser;
  const isAssistant = message.role === ChatMessageRoleAssistant;
  const reasoningContent = getReasoningContent(message);
  const isGenerating = !isTerminalStatus(message.status);
  const hasTools = message.tool_invocations && message.tool_invocations.length > 0;

  if (message.role === 'tool') {
    return null;
  }

  if (!hasTextContent(message) && !reasoningContent && !hasTools) {
    return null;
  }

  return (
    <MessageBubble message={message}>
      {isAssistant && reasoningContent && (
        <MessageReasoning
          reasoning={reasoningContent}
          isReasoning={isGenerating && !hasTextContent(message)}
        />
      )}
      <MessageContent message={message} truncate={isUser} />
      {isAssistant && <ToolInvocations message={message} />}
      {isAssistant && isGenerating && <MessageStatusIndicator />}
    </MessageBubble>
  );
});

const MessageList = memo(function MessageList({
  messages,
  isGenerating,
}: {
  messages: ChatMessageDTO[];
  isGenerating: boolean;
}) {
  // Show typing indicator when generating and last message is user or has no content yet
  const lastMessage = messages[messages.length - 1];
  const showTyping =
    isGenerating &&
    (!lastMessage ||
      lastMessage.role === 'user' ||
      !lastMessage.content?.some(c => c.type === 'text' && c.text?.trim()));

  return (
    <div className="space-y-4 p-4">
      {messages.map((message, index) => (
        <MessageRow
          key={message.id}
          message={message}
          isLast={index === messages.length - 1}
        />
      ))}
      {showTyping && <MessageStatusIndicator label="thinking..." />}
    </div>
  );
});

const AgentContent = memo(function AgentContent({
  className,
  compact,
  allowFiles = true,
  allowImages = true,
  description,
  examplePrompts,
}: {
  className?: string;
  compact?: boolean;
  allowFiles?: boolean;
  allowImages?: boolean;
  description?: string;
  examplePrompts?: string[];
}) {
  const { messages, isGenerating } = useAgentChat();
  const hasMessages = messages.length > 0;

  return (
    <ChatContainer className={cn('h-full p-2', className)}>
      {!compact && <DefaultHeader />}
      {hasMessages ? (
        <ChatMessages className="flex-1">
          {({ messages }) => <MessageList messages={messages} isGenerating={isGenerating} />}
        </ChatMessages>
      ) : (
        <EmptyState description={description} examplePrompts={examplePrompts} />
      )}
      <ChatInput allowFiles={allowFiles} allowImages={allowImages} />
    </ChatContainer>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export function Agent({
  proxyUrl,
  apiKey,
  baseUrl,
  config,
  name,
  chatId,
  className,
  compact = false,
  allowFiles = true,
  allowImages = true,
  onChatCreated,
  description,
  examplePrompts,
}: AgentProps) {
  // Create client internally - memoized to prevent re-creation
  const client = useMemo(() => {
    if (!proxyUrl && !apiKey) {
      console.error('[Agent] Either proxyUrl or apiKey is required');
      return null;
    }
    return new Inference({ proxyUrl, apiKey, baseUrl });
  }, [proxyUrl, apiKey, baseUrl]);

  if (!client) {
    return null;
  }

  // Extract description and example prompts from ad-hoc config, or use props
  const effectiveDescription = description ?? (isAdHocConfig(config) ? config.description : undefined);
  const effectiveExamplePrompts = examplePrompts ?? (isAdHocConfig(config) ? config.example_prompts : undefined);

  return (
    <AgentChatProvider
      client={client}
      agentConfig={config}
      chatId={chatId}
      onChatCreated={onChatCreated}
    >
      <AgentContent
        className={className}
        compact={compact}
        allowFiles={allowFiles}
        allowImages={allowImages}
        description={effectiveDescription}
        examplePrompts={effectiveExamplePrompts}
      />
    </AgentChatProvider>
  );
}

Agent.displayName = 'Agent';
