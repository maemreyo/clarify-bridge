//  Anthropic Claude Provider implementation

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  LLMProvider,
  LLMGenerationOptions,
  LLMMessage,
  LLMGenerationResult,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly priority = 3;
  private readonly logger = new Logger(AnthropicProvider.name);
  private chatModel: ChatAnthropic;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');

    if (this.apiKey) {
      this.chatModel = new ChatAnthropic({
        anthropicApiKey: this.apiKey,
        modelName: 'claude-3-opus-20240229',
        temperature: 0.7,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.chatModel.invoke([new HumanMessage('test')], {
        maxTokens: 1,
      });
      return true;
    } catch (error) {
      this.logger.warn(`Anthropic provider is not available: ${error.message}`);
      return false;
    }
  }

  async generateText(prompt: string, options?: LLMGenerationOptions): Promise<LLMGenerationResult> {
    try {
      const response = await this.chatModel.invoke([new HumanMessage(prompt)], {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens || 4096,
        topP: options?.topP,
        stopSequences: options?.stopSequences,
      });

      return {
        content: response.content.toString(),
        usage: response.usage_metadata
          ? {
              promptTokens: response.usage_metadata.input_tokens || 0,
              completionTokens: response.usage_metadata.output_tokens || 0,
              totalTokens: response.usage_metadata.total_tokens || 0,
            }
          : undefined,
        model: options?.model || 'claude-3-opus-20240229',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`Anthropic generation failed: ${error.message}`);
      throw error;
    }
  }

  async generateChat(
    messages: LLMMessage[],
    options?: LLMGenerationOptions,
  ): Promise<LLMGenerationResult> {
    try {
      const langchainMessages = messages.map(msg => {
        switch (msg.role) {
          case 'system':
            return new SystemMessage(msg.content);
          case 'user':
            return new HumanMessage(msg.content);
          case 'assistant':
            return new AIMessage(msg.content);
        }
      });

      const response = await this.chatModel.invoke(langchainMessages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens || 4096,
        topP: options?.topP,
        stopSequences: options?.stopSequences,
      });

      return {
        content: response.content.toString(),
        usage: response.usage_metadata
          ? {
              promptTokens: response.usage_metadata.input_tokens || 0,
              completionTokens: response.usage_metadata.output_tokens || 0,
              totalTokens: response.usage_metadata.total_tokens || 0,
            }
          : undefined,
        model: options?.model || 'claude-3-opus-20240229',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`Anthropic chat generation failed: ${error.message}`);
      throw error;
    }
  }
}

// ============================================
