import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockAiProvider,
    private readonly openAiProvider: OpenAiCompatibleProvider,
  ) {}

  async getProvider(): Promise<AiProvider> {
    const providerType = (
      this.configService.get<string>('AI_PROVIDER_TYPE') || 'mock'
    ).toLowerCase();

    if (providerType === 'openai') {
      const isAvailable = await this.openAiProvider.isAvailable();
      if (isAvailable) {
        return this.openAiProvider;
      }
      this.logger.warn('OpenAI provider requested but API key not found. Falling back to heuristic provider.');
      return this.mockProvider;
    }

    if (providerType === 'mock') {
      return this.mockProvider;
    }

    // Auto mode
    const isOpenAiReady = await this.openAiProvider.isAvailable();
    if (isOpenAiReady) {
      return this.openAiProvider;
    }

    return this.mockProvider;
  }
}
