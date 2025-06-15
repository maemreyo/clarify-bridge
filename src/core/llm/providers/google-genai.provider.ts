//  Google Generative AI Provider implementation

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
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
export class GoogleGenAIProvider implements LLMProvider, LLMEmbeddingProvider {
  readonly name = 'google-genai';
  readonly priority = 2;
  private readonly logger = new Logger(GoogleGenAIProvider.name);
  private chatModel: ChatGoogleGenerativeAI;
  private embeddingModel: GoogleGenerativeAIEmbeddings;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_API_KEY', '');

    if (this.apiKey) {
      this.chatModel = new ChatGoogleGenerativeAI({
        apiKey: this.apiKey,
        modelName: 'gemini-pro',
        temperature: 0.7,
      });

      this.embeddingModel = new GoogleGenerativeAIEmbeddings({
        apiKey: this.apiKey,
        modelName: 'embedding-001',
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.chatModel.invoke([new HumanMessage('test')]);
      return true;
    } catch (error) {
      this.logger.warn(`Google GenAI provider is not available: ${error.message}`);
      return false;
    }
  }

  async generateText(prompt: string, options?: LLMGenerationOptions): Promise<LLMGenerationResult> {
    try {
      const response = await this.chatModel.invoke([new HumanMessage(prompt)], {
        // generationConfig: {
        //   temperature: options?.temperature,
        //   maxOutputTokens: options?.maxTokens,
        //   topP: options?.topP,
        //   stopSequences: options?.stopSequences,
        // },
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
        model: options?.model || 'gemini-pro',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`Google GenAI generation failed: ${error.message}`);
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
        // generationConfig: {
        //   temperature: options?.temperature,
        //   maxOutputTokens: options?.maxTokens,
        //   topP: options?.topP,
        //   stopSequences: options?.stopSequences,
        // },
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
        model: options?.model || 'gemini-pro',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`Google GenAI chat generation failed: ${error.message}`);
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
        model: options?.model || 'embedding-001',
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`Google GenAI embedding failed: ${error.message}`);
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
        model: options?.model || 'embedding-001',
        provider: this.name,
      }));
    } catch (error) {
      this.logger.error(`Google GenAI batch embedding failed: ${error.message}`);
      throw error;
    }
  }
}

// ============================================
