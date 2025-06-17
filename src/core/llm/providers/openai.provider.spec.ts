// UPDATED: 2025-06-17 - Added comprehensive OpenAI provider tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from './openai.provider';
import { LLMGenerationOptions, LLMMessage } from '../interfaces/llm-provider.interface';

// Mock LangChain modules
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn(),
  })),
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn(),
    embedDocuments: jest.fn(),
  })),
}));

jest.mock('@langchain/core/messages', () => ({
  HumanMessage: jest.fn().mockImplementation((content) => ({ content, type: 'human' })),
  SystemMessage: jest.fn().mockImplementation((content) => ({ content, type: 'system' })),
  AIMessage: jest.fn().mockImplementation((content) => ({ content, type: 'ai' })),
}));

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockChatModel: any;
  let mockEmbeddingModel: any;

  const mockApiKey = 'sk-test-api-key';
  const mockGenerationResponse = {
    content: { toString: () => 'Generated response text' },
    response_metadata: {
      input_tokens: 50,
      output_tokens: 100,
      total_tokens: 150,
    },
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<OpenAIProvider>(OpenAIProvider);
    configService = module.get(ConfigService);

    // Setup mock models
    const { ChatOpenAI, OpenAIEmbeddings } = require('@langchain/openai');
    mockChatModel = new ChatOpenAI();
    mockEmbeddingModel = new OpenAIEmbeddings();

    // Mock the provider's private properties
    (provider as any).chatModel = mockChatModel;
    (provider as any).embeddingModel = mockEmbeddingModel;
  });

  describe('constructor', () => {
    it('should initialize with API key from config', () => {
      // Arrange
      configService.get.mockReturnValue(mockApiKey);

      // Act
      const newProvider = new OpenAIProvider(configService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('OPENAI_API_KEY', '');
      expect(newProvider.name).toBe('openai');
      expect(newProvider.priority).toBe(1);
    });

    it('should handle missing API key gracefully', () => {
      // Arrange
      configService.get.mockReturnValue('');

      // Act
      const newProvider = new OpenAIProvider(configService);

      // Assert
      expect(newProvider.name).toBe('openai');
      expect((newProvider as any).apiKey).toBe('');
    });
  });

  describe('isAvailable', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should return false when no API key is configured', async () => {
      // Arrange
      (provider as any).apiKey = '';

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when API connection test succeeds', async () => {
      // Arrange
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(true);
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: 'test', type: 'human' })],
        {}
      );
    });

    it('should return false when API connection test fails', async () => {
      // Arrange
      mockChatModel.invoke.mockRejectedValue(new Error('API connection failed'));

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });

    it('should log warning when provider is not available', async () => {
      // Arrange
      const loggerSpy = jest.spyOn((provider as any).logger, 'warn').mockImplementation();
      mockChatModel.invoke.mockRejectedValue(new Error('Invalid API key'));

      // Act
      await provider.isAvailable();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'OpenAI provider is not available: Invalid API key'
      );
    });
  });

  describe('generateText', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate text successfully with default options', async () => {
      // Arrange
      const prompt = 'Write a short story';
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(prompt);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: prompt, type: 'human' })],
        {}
      );
      expect(result).toEqual({
        content: 'Generated response text',
        usage: {
          promptTokens: 50,
          completionTokens: 100,
          totalTokens: 150,
        },
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
      });
    });

    it('should generate text with custom options', async () => {
      // Arrange
      const prompt = 'Write a poem';
      const options: LLMGenerationOptions = {
        temperature: 0.8,
        maxTokens: 100,
        model: 'gpt-3.5-turbo',
      };
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(prompt, options);

      // Assert
      expect(result.model).toBe('gpt-3.5-turbo');
      expect(result.provider).toBe('openai');
    });

    it('should handle response without metadata', async () => {
      // Arrange
      const prompt = 'Simple prompt';
      const responseWithoutMetadata = {
        content: { toString: () => 'Response without metadata' },
        response_metadata: undefined,
      };
      mockChatModel.invoke.mockResolvedValue(responseWithoutMetadata);

      // Act
      const result = await provider.generateText(prompt);

      // Assert
      expect(result.usage).toBeUndefined();
      expect(result.content).toBe('Response without metadata');
    });

    it('should throw error when generation fails', async () => {
      // Arrange
      const prompt = 'Test prompt';
      const error = new Error('OpenAI API error');
      mockChatModel.invoke.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateText(prompt)).rejects.toThrow('OpenAI API error');
      expect(loggerSpy).toHaveBeenCalledWith('OpenAI generation failed: OpenAI API error');
    });
  });

  describe('generateChat', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate chat response with multiple messages', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [
          expect.objectContaining({ content: 'You are a helpful assistant', type: 'system' }),
          expect.objectContaining({ content: 'Hello', type: 'human' }),
          expect.objectContaining({ content: 'Hi there!', type: 'ai' }),
          expect.objectContaining({ content: 'How are you?', type: 'human' }),
        ],
        {}
      );
      expect(result.content).toBe('Generated response text');
      expect(result.provider).toBe('openai');
    });

    it('should generate chat with options', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Tell me a joke' },
      ];
      const options: LLMGenerationOptions = {
        temperature: 0.9,
        maxTokens: 50,
      };
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.provider).toBe('openai');
    });

    it('should throw error when chat generation fails', async () => {
      // Arrange
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const error = new Error('Chat API error');
      mockChatModel.invoke.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateChat(messages)).rejects.toThrow('Chat API error');
      expect(loggerSpy).toHaveBeenCalledWith('OpenAI chat generation failed: Chat API error');
    });
  });

  describe('generateEmbedding', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate embedding for text', async () => {
      // Arrange
      const text = 'Sample text for embedding';
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockEmbeddingModel.embedQuery.mockResolvedValue(mockEmbedding);

      // Act
      const result = await provider.generateEmbedding(text);

      // Assert
      expect(mockEmbeddingModel.embedQuery).toHaveBeenCalledWith(text);
      expect(result).toEqual({
        embedding: mockEmbedding,
        model: 'text-embedding-ada-002',
        provider: 'openai',
      });
    });

    it('should generate embedding with custom model', async () => {
      // Arrange
      const text = 'Custom embedding text';
      const options = { model: 'text-embedding-3-small' };
      const mockEmbedding = [0.6, 0.7, 0.8];
      mockEmbeddingModel.embedQuery.mockResolvedValue(mockEmbedding);

      // Act
      const result = await provider.generateEmbedding(text, options);

      // Assert
      expect(result.model).toBe('text-embedding-3-small');
      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('should throw error when embedding fails', async () => {
      // Arrange
      const text = 'Test text';
      const error = new Error('Embedding API error');
      mockEmbeddingModel.embedQuery.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateEmbedding(text)).rejects.toThrow('Embedding API error');
      expect(loggerSpy).toHaveBeenCalledWith('OpenAI embedding failed: Embedding API error');
    });
  });

  describe('generateEmbeddings', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate embeddings for multiple texts', async () => {
      // Arrange
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ];
      mockEmbeddingModel.embedDocuments.mockResolvedValue(mockEmbeddings);

      // Act
      const results = await provider.generateEmbeddings(texts);

      // Assert
      expect(mockEmbeddingModel.embedDocuments).toHaveBeenCalledWith(texts);
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-ada-002',
        provider: 'openai',
      });
      expect(results[1]).toEqual({
        embedding: [0.4, 0.5, 0.6],
        model: 'text-embedding-ada-002',
        provider: 'openai',
      });
      expect(results[2]).toEqual({
        embedding: [0.7, 0.8, 0.9],
        model: 'text-embedding-ada-002',
        provider: 'openai',
      });
    });

    it('should generate embeddings with custom options', async () => {
      // Arrange
      const texts = ['Text A', 'Text B'];
      const options = { model: 'text-embedding-3-large' };
      const mockEmbeddings = [
        [0.1, 0.2],
        [0.3, 0.4],
      ];
      mockEmbeddingModel.embedDocuments.mockResolvedValue(mockEmbeddings);

      // Act
      const results = await provider.generateEmbeddings(texts, options);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].model).toBe('text-embedding-3-large');
      expect(results[1].model).toBe('text-embedding-3-large');
    });

    it('should handle empty text array', async () => {
      // Arrange
      const texts: string[] = [];
      mockEmbeddingModel.embedDocuments.mockResolvedValue([]);

      // Act
      const results = await provider.generateEmbeddings(texts);

      // Assert
      expect(results).toHaveLength(0);
      expect(mockEmbeddingModel.embedDocuments).toHaveBeenCalledWith([]);
    });

    it('should throw error when batch embedding fails', async () => {
      // Arrange
      const texts = ['Text 1', 'Text 2'];
      const error = new Error('Batch embedding error');
      mockEmbeddingModel.embedDocuments.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateEmbeddings(texts)).rejects.toThrow('Batch embedding error');
      expect(loggerSpy).toHaveBeenCalledWith('OpenAI batch embedding failed: Batch embedding error');
    });
  });

  describe('provider properties', () => {
    it('should have correct name and priority', () => {
      expect(provider.name).toBe('openai');
      expect(provider.priority).toBe(1);
    });

    it('should implement LLMProvider interface', () => {
      expect(typeof provider.generateText).toBe('function');
      expect(typeof provider.generateChat).toBe('function');
      expect(typeof provider.isAvailable).toBe('function');
    });

    it('should implement LLMEmbeddingProvider interface', () => {
      expect(typeof provider.generateEmbedding).toBe('function');
      expect(typeof provider.generateEmbeddings).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle very long prompts', async () => {
      // Arrange
      const longPrompt = 'A'.repeat(10000);
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(longPrompt);

      // Assert
      expect(result.content).toBe('Generated response text');
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: longPrompt })],
        {}
      );
    });

    it('should handle special characters in prompts', async () => {
      // Arrange
      const specialPrompt = 'Test with émojis 🚀 and symbols ™️©®';
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(specialPrompt);

      // Assert
      expect(result.content).toBe('Generated response text');
    });

    it('should handle network timeout errors gracefully', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockChatModel.invoke.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Request timeout');
    });
  });
});