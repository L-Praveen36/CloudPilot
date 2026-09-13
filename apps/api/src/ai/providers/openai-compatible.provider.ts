import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiCompletionOptions,
  AiCompletionResult,
  AiMessage,
} from './ai-provider.interface';

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);
  public readonly name = 'openai-compatible';
  public readonly modelIdentifier: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('AI_PROVIDER_API_KEY') || '';
    this.baseUrl = (
      this.configService.get<string>('AI_PROVIDER_BASE_URL') || 'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    this.modelIdentifier =
      this.configService.get<string>('AI_PROVIDER_MODEL') || 'gpt-4o-mini';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async complete(
    prompt: string,
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    const messages: AiMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return this.chat(messages, options);
  }

  async chat(
    messages: AiMessage[],
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      throw new Error('AI Provider API key is not configured.');
    }

    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 25000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelIdentifier,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2048,
          response_format:
            options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `OpenAI Compatible Provider error (${response.status}): ${errorText.substring(0, 200)}`,
        );
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';

      return {
        text,
        model: data.model || this.modelIdentifier,
        tokensUsed: data.usage
          ? {
              prompt: data.usage.prompt_tokens,
              completion: data.usage.completion_tokens,
              total: data.usage.total_tokens,
            }
          : undefined,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`AI Provider request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }
}
