//  OpenAI LLM Provider implementation

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  LLMProvider,
  LLMGenerationOptions,
  LLMMessage,
  LLMGenerationResult,
  LLMEmbeddingProvider,
  LLMEmbeddingOptions,
  LLMEmbeddingResult,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenAIProvider implements LLMProvider, LLMEmbeddingProvider {
  readonly name = 'openai';
  readonly priority = 1;
  private readonly logger = new Logger(OpenAIProvider.name);
  private chatModel: ChatOpenAI;
  private embeddingModel: OpenAIEmbeddings;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');

    if (this.apiKey) {
      this.chatModel = new ChatOpenAI({
        openAIApiKey: this.apiKey,
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7,
      });

      this.embeddingModel = new OpenAIEmbeddings({
        openAIApiKey: this.apiKey,
        modelName: 'text-embedding-ada-002',
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test with a simple prompt
      await this.chatModel.invoke([new HumanMessage('test')], {
        // maxTokens: 1,
      });
      return true;
    } catch (error) {
      this.logger.warn(`OpenAI provider is not available: ${error.message}`);
      return false;
    }
  }

  async generateText(prompt: string, options?: LLMGenerationOptions): Promise<LLMGenerationResult> {
    try {
      const response = await this.chatModel.invoke([new HumanMessage(prompt)], {
        // temperature: options?.temperature,
        // maxTokens: options?.maxTokens,
        // topP: options?.topP,
        // frequencyPenalty: options?.frequencyPenalty,
        // presencePenalty: options?.presencePenalty,
        // stop: options?.stopSequences,
      });

      return {
        content: response.content.toString(),
        usage: response.response_metadata
          ? {
              promptTokens: response.response_metadata.input_tokens || 0,
              completionTokens: response.response_metadata.output_tokens || 0,
              totalTokens: response.response_metadata.total_tokens || 0,
            }
          : undefined,
        model: options?.model || 'gpt-4-turbo-preview',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`OpenAI generation failed: ${error.message}`);
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
        // temperature: options?.temperature,
        // maxTokens: options?.maxTokens,
        // topP: options?.topP,
        // frequencyPenalty: options?.frequencyPenalty,
        // presencePenalty: options?.presencePenalty,
        // stop: options?.stopSequences,
      });

      return {
        content: response.content.toString(),
        usage: response.response_metadata
          ? {
              promptTokens: response.response_metadata.input_tokens || 0,
              completionTokens: response.response_metadata.output_tokens || 0,
              totalTokens: response.response_metadata.total_tokens || 0,
            }
          : undefined,
        model: options?.model || 'gpt-4-turbo-preview',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`OpenAI chat generation failed: ${error.message}`);
      throw error;
    }
  }

  async generateEmbedding(
    text: string,
    options?: LLMEmbeddingOptions,
  ): Promise<LLMEmbeddingResult> {
    try {
      const embedding = await this.embeddingModel.embedQuery(text);

      return {
        embedding,
        model: options?.model || 'text-embedding-ada-002',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`OpenAI embedding failed: ${error.message}`);
      throw error;
    }
  }

  async generateEmbeddings(
    texts: string[],
    options?: LLMEmbeddingOptions,
  ): Promise<LLMEmbeddingResult[]> {
    try {
      const embeddings = await this.embeddingModel.embedDocuments(texts);

      return embeddings.map(embedding => ({
        embedding,
        model: options?.model || 'text-embedding-ada-002',
        provider: this.name,
      }));
    } catch (error) {
      this.logger.error(`OpenAI batch embedding failed: ${error.message}`);
      throw error;
    }
  }
}

// ============================================
