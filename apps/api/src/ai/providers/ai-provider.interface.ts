export interface AiCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AiCompletionResult {
  text: string;
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  durationMs: number;
}

export interface AiProvider {
  readonly name: string;
  readonly modelIdentifier: string;

  isAvailable(): Promise<boolean>;

  complete(
    prompt: string,
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult>;

  chat(
    messages: AiMessage[],
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult>;
}
