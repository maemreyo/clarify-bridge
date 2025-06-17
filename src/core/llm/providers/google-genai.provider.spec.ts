// UPDATED: 2025-06-17 - Added comprehensive Google GenAI provider tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAIProvider } from './google-genai.provider';
import { LLMGenerationOptions, LLMMessage } from '../interfaces/llm-provider.interface';

// Mock LangChain modules
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn(),
  })),
  GoogleGenerativeAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn(),
    embedDocuments: jest.fn(),
  })),
}));

jest.mock('@langchain/core/messages', () => ({
  HumanMessage: jest.fn().mockImplementation((content) => ({ content, type: 'human' })),
  SystemMessage: jest.fn().mockImplementation((content) => ({ content, type: 'system' })),
  AIMessage: jest.fn().mockImplementation((content) => ({ content, type: 'ai' })),
}));

describe('GoogleGenAIProvider', () => {
  let provider: GoogleGenAIProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockChatModel: any;
  let mockEmbeddingModel: any;

  const mockApiKey = 'test-google-ai-api-key';
  const mockGenerationResponse = {
    content: { toString: () => 'Gemini generated response' },
    response_metadata: {
      input_tokens: 30,
      output_tokens: 80,
      total_tokens: 110,
    },
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleGenAIProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<GoogleGenAIProvider>(GoogleGenAIProvider);
    configService = module.get(ConfigService);

    // Setup mock models
    const { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
    mockChatModel = new ChatGoogleGenerativeAI();
    mockEmbeddingModel = new GoogleGenerativeAIEmbeddings();

    // Mock the provider's private properties
    (provider as any).chatModel = mockChatModel;
    (provider as any).embeddingModel = mockEmbeddingModel;
  });

  describe('constructor', () => {
    it('should initialize with API key from config', () => {
      // Arrange
      configService.get.mockReturnValue(mockApiKey);

      // Act
      const newProvider = new GoogleGenAIProvider(configService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('GOOGLE_API_KEY', '');
      expect(newProvider.name).toBe('google-genai');
      expect(newProvider.priority).toBe(2);
    });

    it('should handle missing API key gracefully', () => {
      // Arrange
      configService.get.mockReturnValue('');

      // Act
      const newProvider = new GoogleGenAIProvider(configService);

      // Assert
      expect(newProvider.name).toBe('google-genai');
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
        [expect.objectContaining({ content: 'test', type: 'human' })]
      );
    });

    it('should return false when API connection test fails', async () => {
      // Arrange
      mockChatModel.invoke.mockRejectedValue(new Error('Google AI API connection failed'));

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });

    it('should log warning when provider is not available', async () => {
      // Arrange
      const loggerSpy = jest.spyOn((provider as any).logger, 'warn').mockImplementation();
      mockChatModel.invoke.mockRejectedValue(new Error('Invalid Google AI API key'));

      // Act
      await provider.isAvailable();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Google GenAI provider is not available: Invalid Google AI API key'
      );
    });
  });

  describe('generateText', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate text successfully with default options', async () => {
      // Arrange
      const prompt = 'Explain quantum computing';
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(prompt);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: prompt, type: 'human' })],
        {}
      );
      expect(result).toEqual({
        content: 'Gemini generated response',
        usage: {
          promptTokens: 30,
          completionTokens: 80,
          totalTokens: 110,
        },
        model: 'gemini-pro',
        provider: 'google-genai',
      });
    });

    it('should generate text with custom options', async () => {
      // Arrange
      const prompt = 'Write creative content';
      const options: LLMGenerationOptions = {
        temperature: 0.9,
        maxTokens: 500,
        model: 'gemini-pro-vision',
      };
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(prompt, options);

      // Assert
      expect(result.model).toBe('gemini-pro-vision');
      expect(result.provider).toBe('google-genai');
      expect(result.content).toBe('Gemini generated response');
    });

    it('should handle response without metadata', async () => {
      // Arrange
      const prompt = 'Simple test prompt';
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
      expect(result.model).toBe('gemini-pro');
    });

    it('should throw error when generation fails', async () => {
      // Arrange
      const prompt = 'Test prompt';
      const error = new Error('Google GenAI API rate limit exceeded');
      mockChatModel.invoke.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateText(prompt)).rejects.toThrow('Google GenAI API rate limit exceeded');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Google GenAI generation failed: Google GenAI API rate limit exceeded'
      );
    });
  });

  describe('generateChat', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate chat response with multiple messages', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful AI assistant powered by Gemini' },
        { role: 'user', content: 'What is machine learning?' },
        { role: 'assistant', content: 'Machine learning is a subset of AI...' },
        { role: 'user', content: 'Can you give me an example?' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [
          expect.objectContaining({ content: 'You are a helpful AI assistant powered by Gemini', type: 'system' }),
          expect.objectContaining({ content: 'What is machine learning?', type: 'human' }),
          expect.objectContaining({ content: 'Machine learning is a subset of AI...', type: 'ai' }),
          expect.objectContaining({ content: 'Can you give me an example?', type: 'human' }),
        ],
        {}
      );
      expect(result.content).toBe('Gemini generated response');
      expect(result.provider).toBe('google-genai');
    });

    it('should generate chat with generation options', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Tell me about space exploration' },
      ];
      const options: LLMGenerationOptions = {
        temperature: 0.7,
        maxTokens: 200,
        topP: 0.9,
      };
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.provider).toBe('google-genai');
      expect(result.model).toBe('gemini-pro');
    });

    it('should handle single user message', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello Gemini!' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: 'Hello Gemini!', type: 'human' })],
        {}
      );
      expect(result.content).toBe('Gemini generated response');
    });

    it('should throw error when chat generation fails', async () => {
      // Arrange
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test message' }];
      const error = new Error('Gemini service unavailable');
      mockChatModel.invoke.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateChat(messages)).rejects.toThrow('Gemini service unavailable');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Google GenAI chat generation failed: Gemini service unavailable'
      );
    });
  });

  describe('generateEmbedding', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate embedding for text', async () => {
      // Arrange
      const text = 'Sample text for Google AI embedding';
      const mockEmbedding = [0.2, 0.4, 0.6, 0.8, 1.0];
      mockEmbeddingModel.embedQuery.mockResolvedValue(mockEmbedding);

      // Act
      const result = await provider.generateEmbedding(text);

      // Assert
      expect(mockEmbeddingModel.embedQuery).toHaveBeenCalledWith(text);
      expect(result).toEqual({
        embedding: mockEmbedding,
        model: 'embedding-001',
        provider: 'google-genai',
      });
    });

    it('should generate embedding with custom model', async () => {
      // Arrange
      const text = 'Custom embedding text for Gemini';
      const options = { model: 'embedding-gecko-001' };
      const mockEmbedding = [0.1, 0.3, 0.5, 0.7];
      mockEmbeddingModel.embedQuery.mockResolvedValue(mockEmbedding);

      // Act
      const result = await provider.generateEmbedding(text, options);

      // Assert
      expect(result.model).toBe('embedding-gecko-001');
      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.provider).toBe('google-genai');
    });

    it('should handle empty text', async () => {
      // Arrange
      const text = '';
      const mockEmbedding = [0.0, 0.0, 0.0];
      mockEmbeddingModel.embedQuery.mockResolvedValue(mockEmbedding);

      // Act
      const result = await provider.generateEmbedding(text);

      // Assert
      expect(result.embedding).toEqual([0.0, 0.0, 0.0]);
      expect(result.provider).toBe('google-genai');
    });

    it('should throw error when embedding fails', async () => {
      // Arrange
      const text = 'Test text';
      const error = new Error('Google AI embedding service error');
      mockEmbeddingModel.embedQuery.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateEmbedding(text)).rejects.toThrow('Google AI embedding service error');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Google GenAI embedding failed: Google AI embedding service error'
      );
    });
  });

  describe('generateEmbeddings', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate embeddings for multiple texts', async () => {
      // Arrange
      const texts = ['First document', 'Second document', 'Third document'];
      const mockEmbeddings = [
        [0.1, 0.2, 0.3, 0.4],
        [0.5, 0.6, 0.7, 0.8],
        [0.9, 1.0, 1.1, 1.2],
      ];
      mockEmbeddingModel.embedDocuments.mockResolvedValue(mockEmbeddings);

      // Act
      const results = await provider.generateEmbeddings(texts);

      // Assert
      expect(mockEmbeddingModel.embedDocuments).toHaveBeenCalledWith(texts);
      expect(results).toHaveLength(3);

      expect(results[0]).toEqual({
        embedding: [0.1, 0.2, 0.3, 0.4],
        model: 'embedding-001',
        provider: 'google-genai',
      });

      expect(results[1]).toEqual({
        embedding: [0.5, 0.6, 0.7, 0.8],
        model: 'embedding-001',
        provider: 'google-genai',
      });

      expect(results[2]).toEqual({
        embedding: [0.9, 1.0, 1.1, 1.2],
        model: 'embedding-001',
        provider: 'google-genai',
      });
    });

    it('should generate embeddings with custom options', async () => {
      // Arrange
      const texts = ['Document A', 'Document B'];
      const options = { model: 'embedding-gecko-multilingual-001' };
      const mockEmbeddings = [
        [0.2, 0.4],
        [0.6, 0.8],
      ];
      mockEmbeddingModel.embedDocuments.mockResolvedValue(mockEmbeddings);

      // Act
      const results = await provider.generateEmbeddings(texts, options);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].model).toBe('embedding-gecko-multilingual-001');
      expect(results[1].model).toBe('embedding-gecko-multilingual-001');
    });

    it('should handle single text in array', async () => {
      // Arrange
      const texts = ['Single document'];
      const mockEmbeddings = [[0.5, 0.5, 0.5]];
      mockEmbeddingModel.embedDocuments.mockResolvedValue(mockEmbeddings);

      // Act
      const results = await provider.generateEmbeddings(texts);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].embedding).toEqual([0.5, 0.5, 0.5]);
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
      const texts = ['Doc 1', 'Doc 2'];
      const error = new Error('Google AI batch embedding failed');
      mockEmbeddingModel.embedDocuments.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateEmbeddings(texts)).rejects.toThrow('Google AI batch embedding failed');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Google GenAI batch embedding failed: Google AI batch embedding failed'
      );
    });
  });

  describe('provider properties', () => {
    it('should have correct name and priority', () => {
      expect(provider.name).toBe('google-genai');
      expect(provider.priority).toBe(2);
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

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should handle very long text inputs', async () => {
      // Arrange
      const longText = 'A'.repeat(50000);
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(longText);

      // Assert
      expect(result.content).toBe('Gemini generated response');
    });

    it('should handle multilingual content', async () => {
      // Arrange
      const multilingualPrompt = 'Hello 你好 Bonjour こんにちは مرحبا';
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(multilingualPrompt);

      // Assert
      expect(result.provider).toBe('google-genai');
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: multilingualPrompt })],
        {}
      );
    });

    it('should handle API quota exceeded error', async () => {
      // Arrange
      const quotaError = new Error('API quota exceeded');
      quotaError.name = 'QuotaExceededError';
      mockChatModel.invoke.mockRejectedValue(quotaError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('API quota exceeded');
    });

    it('should handle invalid model configuration', async () => {
      // Arrange
      const modelError = new Error('Model not found');
      mockChatModel.invoke.mockRejectedValue(modelError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Model not found');
    });

    it('should handle safety filter violations', async () => {
      // Arrange
      const safetyError = new Error('Content blocked by safety filters');
      mockChatModel.invoke.mockRejectedValue(safetyError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Content blocked by safety filters');
    });
  });
});