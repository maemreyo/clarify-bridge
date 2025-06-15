// Updated: Core LLM service with provider management and fallback

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMProvider,
  LLMGenerationOptions,
  LLMMessage,
  LLMGenerationResult,
  LLMEmbeddingProvider,
  LLMEmbeddingOptions,
  LLMEmbeddingResult,
} from './interfaces/llm-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { GoogleGenAIProvider } from './providers/google-genai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

export interface PromptTemplate {
  system?: string;
  user: string;
  variables?: Record<string, any>;
}

@Injectable()
export class LlmCoreService implements OnModuleInit {
  private readonly logger = new Logger(LlmCoreService.name);
  private providers: LLMProvider[] = [];
  private embeddingProviders: LLMEmbeddingProvider[] = [];
  private availableProviders: Set<string> = new Set();

  constructor(
    private configService: ConfigService,
    private openAIProvider: OpenAIProvider,
    private googleGenAIProvider: GoogleGenAIProvider,
    private anthropicProvider: AnthropicProvider,
  ) {}

  async onModuleInit() {
    // Register providers
    this.providers = [
      this.openAIProvider,
      this.googleGenAIProvider,
      this.anthropicProvider,
    ].sort((a, b) => a.priority - b.priority);

    // Register embedding providers
    this.embeddingProviders = [
      this.openAIProvider,
      this.googleGenAIProvider,
    ];

    // Check availability
    await this.checkProviderAvailability();
  }

  private async checkProviderAvailability() {
    this.logger.log('Checking LLM provider availability...');

    for (const provider of this.providers) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        this.availableProviders.add(provider.name);
        this.logger.log(`✓ ${provider.name} is available`);
      } else {
        this.logger.warn(`✗ ${provider.name} is not available`);
      }
    }

    if (this.availableProviders.size === 0) {
      this.logger.error('No LLM providers are available!');
    }
  }

  async generateText(
    prompt: string,
    options?: LLMGenerationOptions & { provider?: string },
  ): Promise<LLMGenerationResult> {
    const selectedProvider = this.selectProvider(options?.provider);

    if (!selectedProvider) {
      throw new Error('No LLM provider available');
    }

    try {
      this.logger.debug(`Using ${selectedProvider.name} for text generation`);
      return await selectedProvider.generateText(prompt, options);
    } catch (error) {
      this.logger.error(`Generation failed with ${selectedProvider.name}: ${error.message}`);

      // Try fallback provider
      const fallbackProvider = this.getFallbackProvider(selectedProvider.name);
      if (fallbackProvider) {
        this.logger.warn(`Falling back to ${fallbackProvider.name}`);
        return await fallbackProvider.generateText(prompt, options);
      }

      throw error;
    }
  }

  async generateChat(
    messages: LLMMessage[],
    options?: LLMGenerationOptions & { provider?: string },
  ): Promise<LLMGenerationResult> {
    const selectedProvider = this.selectProvider(options?.provider);

    if (!selectedProvider) {
      throw new Error('No LLM provider available');
    }

    try {
      this.logger.debug(`Using ${selectedProvider.name} for chat generation`);
      return await selectedProvider.generateChat(messages, options);
    } catch (error) {
      this.logger.error(`Chat generation failed with ${selectedProvider.name}: ${error.message}`);

      // Try fallback provider
      const fallbackProvider = this.getFallbackProvider(selectedProvider.name);
      if (fallbackProvider) {
        this.logger.warn(`Falling back to ${fallbackProvider.name}`);
        return await fallbackProvider.generateChat(messages, options);
      }

      throw error;
    }
  }

  async generateFromTemplate(
    template: PromptTemplate,
    options?: LLMGenerationOptions & { provider?: string },
  ): Promise<LLMGenerationResult> {
    const messages: LLMMessage[] = [];

    if (template.system) {
      messages.push({
        role: 'system',
        content: this.fillTemplate(template.system, template.variables),
      });
    }

    messages.push({
      role: 'user',
      content: this.fillTemplate(template.user, template.variables),
    });

    return this.generateChat(messages, options);
  }

  async generateEmbedding(
    text: string,
    options?: LLMEmbeddingOptions & { provider?: string },
  ): Promise<LLMEmbeddingResult> {
    const provider = this.selectEmbeddingProvider(options?.provider);

    if (!provider) {
      throw new Error('No embedding provider available');
    }

    return provider.generateEmbedding(text, options);
  }

  async generateEmbeddings(
    texts: string[],
    options?: LLMEmbeddingOptions & { provider?: string },
  ): Promise<LLMEmbeddingResult[]> {
    const provider = this.selectEmbeddingProvider(options?.provider);

    if (!provider) {
      throw new Error('No embedding provider available');
    }

    return provider.generateEmbeddings(texts, options);
  }

  private selectProvider(preferredProvider?: string): LLMProvider | null {
    if (preferredProvider) {
      const provider = this.providers.find(p => p.name === preferredProvider);
      if (provider && this.availableProviders.has(provider.name)) {
        return provider;
      }
    }

    // Return first available provider
    return this.providers.find(p => this.availableProviders.has(p.name)) || null;
  }

  private selectEmbeddingProvider(preferredProvider?: string): LLMEmbeddingProvider | null {
    if (preferredProvider) {
      const provider = this.embeddingProviders.find(
        p => (p as any).name === preferredProvider
      );
      if (provider && this.availableProviders.has((provider as any).name)) {
        return provider;
      }
    }

    // Return first available embedding provider
    return this.embeddingProviders.find(
      p => this.availableProviders.has((p as any).name)
    ) || null;
  }

  private getFallbackProvider(excludeProvider: string): LLMProvider | null {
    return this.providers.find(
      p => p.name !== excludeProvider && this.availableProviders.has(p.name)
    ) || null;
  }

  private fillTemplate(template: string, variables?: Record<string, any>): string {
    if (!variables) return template;

    let filled = template;
    Object.entries(variables).forEach(([key, value]) => {
      filled = filled.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return filled;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.availableProviders);
  }
}

// ============================================