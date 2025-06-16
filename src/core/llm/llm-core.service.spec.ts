import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmCoreService, PromptTemplate } from './llm-core.service';
import { OpenAIProvider } from './providers/openai.provider';
import { GoogleGenAIProvider } from './providers/google-genai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import {
  LLMGenerationOptions,
  LLMMessage,
  LLMGenerationResult,
  LLMEmbeddingResult,
} from './interfaces/llm-provider.interface';

describe('LlmCoreService', () => {
  let service: LlmCoreService;
  let configService: jest.Mocked<ConfigService>;
  let openAIProvider: jest.Mocked<OpenAIProvider>;
  let googleGenAIProvider: jest.Mocked<GoogleGenAIProvider>;
  let anthropicProvider: jest.Mocked<AnthropicProvider>;

  const mockGenerationResult: LLMGenerationResult = {
    content: 'Generated text',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    model: 'gpt-4',
    provider: 'OpenAI',
  };

  const mockEmbeddingResult: LLMEmbeddingResult = {
    embedding: [0.1, 0.2, 0.3],
    model: 'text-embedding-ada-002',
    provider: 'OpenAI',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmCoreService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: OpenAIProvider,
          useValue: {
            name: 'OpenAI',
            priority: 1,
            isAvailable: jest.fn(),
            generateText: jest.fn(),
            generateChat: jest.fn(),
            generateEmbedding: jest.fn(),
            generateEmbeddings: jest.fn(),
          },
        },
        {
          provide: GoogleGenAIProvider,
          useValue: {
            name: 'GoogleGenAI',
            priority: 2,
            isAvailable: jest.fn(),
            generateText: jest.fn(),
            generateChat: jest.fn(),
            generateEmbedding: jest.fn(),
            generateEmbeddings: jest.fn(),
          },
        },
        {
          provide: AnthropicProvider,
          useValue: {
            name: 'Anthropic',
            priority: 3,
            isAvailable: jest.fn(),
            generateText: jest.fn(),
            generateChat: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LlmCoreService>(LlmCoreService);
    configService = module.get(ConfigService);
    openAIProvider = module.get(OpenAIProvider);
    googleGenAIProvider = module.get(GoogleGenAIProvider);
    anthropicProvider = module.get(AnthropicProvider);

    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should check availability of all providers', async () => {
      // Arrange
      openAIProvider.isAvailable.mockResolvedValue(true);
      googleGenAIProvider.isAvailable.mockResolvedValue(true);
      anthropicProvider.isAvailable.mockResolvedValue(false);

      // Act
      await service.onModuleInit();

      // Assert
      expect(openAIProvider.isAvailable).toHaveBeenCalled();
      expect(googleGenAIProvider.isAvailable).toHaveBeenCalled();
      expect(anthropicProvider.isAvailable).toHaveBeenCalled();
      expect(service.getAvailableProviders()).toEqual(['OpenAI', 'GoogleGenAI']);
    });

    it('should handle when no providers are available', async () => {
      // Arrange
      openAIProvider.isAvailable.mockResolvedValue(false);
      googleGenAIProvider.isAvailable.mockResolvedValue(false);
      anthropicProvider.isAvailable.mockResolvedValue(false);

      // Act
      await service.onModuleInit();

      // Assert
      expect(service.getAvailableProviders()).toEqual([]);
    });
  });

  describe('generateText', () => {
    beforeEach(async () => {
      // Setup available providers
      openAIProvider.isAvailable.mockResolvedValue(true);
      googleGenAIProvider.isAvailable.mockResolvedValue(true);
      anthropicProvider.isAvailable.mockResolvedValue(false);
      await service.onModuleInit();
    });

    it('should generate text using the default provider', async () => {
      // Arrange
      const prompt = 'Generate a story';
      const options: LLMGenerationOptions = { temperature: 0.7 };
      openAIProvider.generateText.mockResolvedValue(mockGenerationResult);

      // Act
      const result = await service.generateText(prompt, options);

      // Assert
      expect(openAIProvider.generateText).toHaveBeenCalledWith(prompt, options);
      expect(result).toEqual(mockGenerationResult);
    });

    it('should use specified provider when requested', async () => {
      // Arrange
      const prompt = 'Generate a story';
      const options = { provider: 'GoogleGenAI', temperature: 0.7 };
      googleGenAIProvider.generateText.mockResolvedValue({
        ...mockGenerationResult,
        provider: 'GoogleGenAI',
      });

      // Act
      const result = await service.generateText(prompt, options);

      // Assert
      expect(googleGenAIProvider.generateText).toHaveBeenCalledWith(prompt, options);
      expect(openAIProvider.generateText).not.toHaveBeenCalled();
      expect(result.provider).toBe('GoogleGenAI');
    });

    it('should fallback to next provider on failure', async () => {
      // Arrange
      const prompt = 'Generate a story';
      openAIProvider.generateText.mockRejectedValue(new Error('API Error'));
      googleGenAIProvider.generateText.mockResolvedValue({
        ...mockGenerationResult,
        provider: 'GoogleGenAI',
      });

      // Act
      const result = await service.generateText(prompt);

      // Assert
      expect(openAIProvider.generateText).toHaveBeenCalled();
      expect(googleGenAIProvider.generateText).toHaveBeenCalled();
      expect(result.provider).toBe('GoogleGenAI');
    });

    it('should throw error when no provider is available', async () => {
      // Arrange
      openAIProvider.isAvailable.mockResolvedValue(false);
      googleGenAIProvider.isAvailable.mockResolvedValue(false);
      anthropicProvider.isAvailable.mockResolvedValue(false);
      await service.onModuleInit();

      // Act & Assert
      await expect(service.generateText('prompt')).rejects.toThrow('No LLM provider available');
    });

    it('should throw error when all providers fail', async () => {
      // Arrange
      const error = new Error('API Error');
      openAIProvider.generateText.mockRejectedValue(error);
      googleGenAIProvider.generateText.mockRejectedValue(error);

      // Act & Assert
      await expect(service.generateText('prompt')).rejects.toThrow('API Error');
    });
  });

  describe('generateChat', () => {
    beforeEach(async () => {
      openAIProvider.isAvailable.mockResolvedValue(true);
      googleGenAIProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should generate chat response', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];
      const options: LLMGenerationOptions = { temperature: 0.8 };
      openAIProvider.generateChat.mockResolvedValue(mockGenerationResult);

      // Act
      const result = await service.generateChat(messages, options);

      // Assert
      expect(openAIProvider.generateChat).toHaveBeenCalledWith(messages, options);
      expect(result).toEqual(mockGenerationResult);
    });

    it('should handle chat generation with fallback', async () => {
      // Arrange
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      openAIProvider.generateChat.mockRejectedValue(new Error('Rate limit'));
      googleGenAIProvider.generateChat.mockResolvedValue({
        ...mockGenerationResult,
        provider: 'GoogleGenAI',
      });

      // Act
      const result = await service.generateChat(messages);

      // Assert
      expect(result.provider).toBe('GoogleGenAI');
    });
  });

  describe('generateFromTemplate', () => {
    beforeEach(async () => {
      openAIProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should generate from template with variables', async () => {
      // Arrange
      const template: PromptTemplate = {
        system: 'You are a {{role}} assistant',
        user: 'Help me with {{task}}',
        variables: {
          role: 'coding',
          task: 'writing tests',
        },
      };
      openAIProvider.generateChat.mockResolvedValue(mockGenerationResult);

      // Act
      const result = await service.generateFromTemplate(template);

      // Assert
      expect(openAIProvider.generateChat).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'You are a coding assistant' },
          { role: 'user', content: 'Help me with writing tests' },
        ],
        undefined,
      );
      expect(result).toEqual(mockGenerationResult);
    });

    it('should handle template without system message', async () => {
      // Arrange
      const template: PromptTemplate = {
        user: 'Simple prompt',
      };
      openAIProvider.generateChat.mockResolvedValue(mockGenerationResult);

      // Act
      await service.generateFromTemplate(template);

      // Assert
      expect(openAIProvider.generateChat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Simple prompt' }],
        undefined,
      );
    });

    it('should handle template without variables', async () => {
      // Arrange
      const template: PromptTemplate = {
        system: 'Static system message',
        user: 'Static user message',
      };
      openAIProvider.generateChat.mockResolvedValue(mockGenerationResult);

      // Act
      await service.generateFromTemplate(template);

      // Assert
      expect(openAIProvider.generateChat).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'Static system message' },
          { role: 'user', content: 'Static user message' },
        ],
        undefined,
      );
    });
  });

  describe('generateEmbedding', () => {
    beforeEach(async () => {
      openAIProvider.isAvailable.mockResolvedValue(true);
      googleGenAIProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should generate embedding for text', async () => {
      // Arrange
      const text = 'Sample text for embedding';
      openAIProvider.generateEmbedding.mockResolvedValue(mockEmbeddingResult);

      // Act
      const result = await service.generateEmbedding(text);

      // Assert
      expect(openAIProvider.generateEmbedding).toHaveBeenCalledWith(text, undefined);
      expect(result).toEqual(mockEmbeddingResult);
    });

    it('should use specified embedding provider', async () => {
      // Arrange
      const text = 'Sample text';
      const options = { provider: 'GoogleGenAI' };
      googleGenAIProvider.generateEmbedding.mockResolvedValue({
        ...mockEmbeddingResult,
        provider: 'GoogleGenAI',
      });

      // Act
      const result = await service.generateEmbedding(text, options);

      // Assert
      expect(googleGenAIProvider.generateEmbedding).toHaveBeenCalled();
      expect(result.provider).toBe('GoogleGenAI');
    });

    it('should throw error when no embedding provider available', async () => {
      // Arrange
      openAIProvider.isAvailable.mockResolvedValue(false);
      googleGenAIProvider.isAvailable.mockResolvedValue(false);
      await service.onModuleInit();

      // Act & Assert
      await expect(service.generateEmbedding('text')).rejects.toThrow(
        'No embedding provider available',
      );
    });
  });

  describe('generateEmbeddings', () => {
    beforeEach(async () => {
      openAIProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should generate embeddings for multiple texts', async () => {
      // Arrange
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockResults = texts.map((_, i) => ({
        ...mockEmbeddingResult,
        embedding: [0.1 * i, 0.2 * i, 0.3 * i],
      }));
      openAIProvider.generateEmbeddings.mockResolvedValue(mockResults);

      // Act
      const results = await service.generateEmbeddings(texts);

      // Assert
      expect(openAIProvider.generateEmbeddings).toHaveBeenCalledWith(texts, undefined);
      expect(results).toEqual(mockResults);
      expect(results).toHaveLength(3);
    });
  });

  describe('provider selection', () => {
    it('should respect provider priority order', async () => {
      // Arrange
      openAIProvider.isAvailable.mockResolvedValue(true);
      googleGenAIProvider.isAvailable.mockResolvedValue(true);
      anthropicProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();

      openAIProvider.generateText.mockResolvedValue(mockGenerationResult);

      // Act
      await service.generateText('test');

      // Assert
      expect(openAIProvider.generateText).toHaveBeenCalled();
      expect(googleGenAIProvider.generateText).not.toHaveBeenCalled();
    });

    it('should skip unavailable providers', async () => {
      // Arrange
      openAIProvider.isAvailable.mockResolvedValue(false);
      googleGenAIProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();

      googleGenAIProvider.generateText.mockResolvedValue({
        ...mockGenerationResult,
        provider: 'GoogleGenAI',
      });

      // Act
      const result = await service.generateText('test');

      // Assert
      expect(openAIProvider.generateText).not.toHaveBeenCalled();
      expect(googleGenAIProvider.generateText).toHaveBeenCalled();
      expect(result.provider).toBe('GoogleGenAI');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      openAIProvider.isAvailable.mockResolvedValue(true);
      googleGenAIProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should handle provider initialization errors', async () => {
      // Arrange
      openAIProvider.isAvailable.mockRejectedValue(new Error('Config error'));

      // Act
      await service.onModuleInit();

      // Assert
      expect(service.getAvailableProviders()).not.toContain('OpenAI');
    });

    it('should handle concurrent generation requests', async () => {
      // Arrange
      openAIProvider.generateText.mockResolvedValue(mockGenerationResult);

      // Act
      const promises = Array(5)
        .fill(null)
        .map((_, i) => service.generateText(`Prompt ${i}`));
      const results = await Promise.all(promises);

      // Assert
      expect(openAIProvider.generateText).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual(mockGenerationResult);
      });
    });

    it('should handle rate limiting with backoff', async () => {
      // Arrange
      let callCount = 0;
      openAIProvider.generateText.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Rate limit exceeded'));
        }
        return Promise.resolve(mockGenerationResult);
      });
      googleGenAIProvider.generateText.mockResolvedValue({
        ...mockGenerationResult,
        provider: 'GoogleGenAI',
      });

      // Act
      const result = await service.generateText('test');

      // Assert
      expect(result.provider).toBe('GoogleGenAI');
    });
  });
});
