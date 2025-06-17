// UPDATED: 2025-06-17 - Added comprehensive Anthropic provider tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './anthropic.provider';
import { LLMGenerationOptions, LLMMessage } from '../interfaces/llm-provider.interface';

// Mock LangChain modules
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({
    invoke: jest.fn(),
  })),
}));

jest.mock('@langchain/core/messages', () => ({
  HumanMessage: jest.fn().mockImplementation((content) => ({ content, type: 'human' })),
  SystemMessage: jest.fn().mockImplementation((content) => ({ content, type: 'system' })),
  AIMessage: jest.fn().mockImplementation((content) => ({ content, type: 'ai' })),
}));

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockChatModel: any;

  const mockApiKey = 'sk-ant-api-test-key';
  const mockGenerationResponse = {
    content: { toString: () => 'Claude generated response' },
    response_metadata: {
      input_tokens: 40,
      output_tokens: 120,
      total_tokens: 160,
    },
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnthropicProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<AnthropicProvider>(AnthropicProvider);
    configService = module.get(ConfigService);

    // Setup mock model
    const { ChatAnthropic } = require('@langchain/anthropic');
    mockChatModel = new ChatAnthropic();

    // Mock the provider's private properties
    (provider as any).chatModel = mockChatModel;
  });

  describe('constructor', () => {
    it('should initialize with API key from config', () => {
      // Arrange
      configService.get.mockReturnValue(mockApiKey);

      // Act
      const newProvider = new AnthropicProvider(configService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('ANTHROPIC_API_KEY', '');
      expect(newProvider.name).toBe('anthropic');
      expect(newProvider.priority).toBe(3);
    });

    it('should handle missing API key gracefully', () => {
      // Arrange
      configService.get.mockReturnValue('');

      // Act
      const newProvider = new AnthropicProvider(configService);

      // Assert
      expect(newProvider.name).toBe('anthropic');
      expect((newProvider as any).apiKey).toBe('');
    });

    it('should use default Claude model', () => {
      // Arrange
      configService.get.mockReturnValue(mockApiKey);

      // Act
      const newProvider = new AnthropicProvider(configService);

      // Assert
      expect(newProvider.name).toBe('anthropic');
      expect(newProvider.priority).toBe(3);
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
      mockChatModel.invoke.mockRejectedValue(new Error('Anthropic API connection failed'));

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });

    it('should log warning when provider is not available', async () => {
      // Arrange
      const loggerSpy = jest.spyOn((provider as any).logger, 'warn').mockImplementation();
      mockChatModel.invoke.mockRejectedValue(new Error('Invalid Anthropic API key'));

      // Act
      await provider.isAvailable();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Anthropic provider is not available: Invalid Anthropic API key'
      );
    });
  });

  describe('generateText', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should generate text successfully with default options', async () => {
      // Arrange
      const prompt = 'Explain the concept of consciousness';
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(prompt);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: prompt, type: 'human' })],
        {}
      );
      expect(result).toEqual({
        content: 'Claude generated response',
        usage: {
          promptTokens: 40,
          completionTokens: 120,
          totalTokens: 160,
        },
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
      });
    });

    it('should generate text with custom options', async () => {
      // Arrange
      const prompt = 'Write a philosophical essay';
      const options: LLMGenerationOptions = {
        temperature: 0.8,
        maxTokens: 1000,
        model: 'claude-3-sonnet-20240229',
      };
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(prompt, options);

      // Assert
      expect(result.model).toBe('claude-3-sonnet-20240229');
      expect(result.provider).toBe('anthropic');
      expect(result.content).toBe('Claude generated response');
    });

    it('should handle response without metadata', async () => {
      // Arrange
      const prompt = 'Simple prompt';
      const responseWithoutMetadata = {
        content: { toString: () => 'Claude response without metadata' },
        response_metadata: undefined,
      };
      mockChatModel.invoke.mockResolvedValue(responseWithoutMetadata);

      // Act
      const result = await provider.generateText(prompt);

      // Assert
      expect(result.usage).toBeUndefined();
      expect(result.content).toBe('Claude response without metadata');
      expect(result.model).toBe('claude-3-opus-20240229');
    });

    it('should handle complex prompts with instructions', async () => {
      // Arrange
      const complexPrompt = `
        Please analyze the following code and provide suggestions for improvement:

        function calculateTotal(items) {
          let total = 0;
          for (let i = 0; i < items.length; i++) {
            total += items[i].price;
          }
          return total;
        }
      `;
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(complexPrompt);

      // Assert
      expect(result.content).toBe('Claude generated response');
      expect(result.provider).toBe('anthropic');
    });

    it('should throw error when generation fails', async () => {
      // Arrange
      const prompt = 'Test prompt';
      const error = new Error('Anthropic API rate limit exceeded');
      mockChatModel.invoke.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateText(prompt)).rejects.toThrow('Anthropic API rate limit exceeded');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Anthropic generation failed: Anthropic API rate limit exceeded'
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
        { role: 'system', content: 'You are Claude, a helpful AI assistant by Anthropic' },
        { role: 'user', content: 'What are the benefits of renewable energy?' },
        { role: 'assistant', content: 'Renewable energy sources offer several key benefits...' },
        { role: 'user', content: 'What about the challenges?' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [
          expect.objectContaining({ content: 'You are Claude, a helpful AI assistant by Anthropic', type: 'system' }),
          expect.objectContaining({ content: 'What are the benefits of renewable energy?', type: 'human' }),
          expect.objectContaining({ content: 'Renewable energy sources offer several key benefits...', type: 'ai' }),
          expect.objectContaining({ content: 'What about the challenges?', type: 'human' }),
        ],
        {}
      );
      expect(result.content).toBe('Claude generated response');
      expect(result.provider).toBe('anthropic');
    });

    it('should generate chat with generation options', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Tell me about artificial intelligence ethics' },
      ];
      const options: LLMGenerationOptions = {
        temperature: 0.6,
        maxTokens: 2000,
        topP: 0.95,
      };
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages, options);

      // Assert
      expect(result).toBeDefined();
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-3-opus-20240229');
    });

    it('should handle conversation with only system message', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a creative writing assistant' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: 'You are a creative writing assistant', type: 'system' })],
        {}
      );
      expect(result.content).toBe('Claude generated response');
    });

    it('should handle conversation without system message', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello Claude!' },
        { role: 'assistant', content: 'Hello! How can I help you today?' },
        { role: 'user', content: 'I need help with a coding problem' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [
          expect.objectContaining({ content: 'Hello Claude!', type: 'human' }),
          expect.objectContaining({ content: 'Hello! How can I help you today?', type: 'ai' }),
          expect.objectContaining({ content: 'I need help with a coding problem', type: 'human' }),
        ],
        {}
      );
      expect(result.provider).toBe('anthropic');
    });

    it('should throw error when chat generation fails', async () => {
      // Arrange
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test message' }];
      const error = new Error('Anthropic service temporarily unavailable');
      mockChatModel.invoke.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateChat(messages)).rejects.toThrow('Anthropic service temporarily unavailable');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Anthropic chat generation failed: Anthropic service temporarily unavailable'
      );
    });
  });

  describe('provider properties', () => {
    it('should have correct name and priority', () => {
      expect(provider.name).toBe('anthropic');
      expect(provider.priority).toBe(3);
    });

    it('should implement LLMProvider interface', () => {
      expect(typeof provider.generateText).toBe('function');
      expect(typeof provider.generateChat).toBe('function');
      expect(typeof provider.isAvailable).toBe('function');
    });

    it('should not implement embedding methods (Anthropic does not provide embeddings)', () => {
      expect((provider as any).generateEmbedding).toBeUndefined();
      expect((provider as any).generateEmbeddings).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should handle very long prompts', async () => {
      // Arrange
      const longPrompt = 'Analyze this text: ' + 'Lorem ipsum '.repeat(10000);
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(longPrompt);

      // Assert
      expect(result.content).toBe('Claude generated response');
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [expect.objectContaining({ content: longPrompt })],
        {}
      );
    });

    it('should handle prompts with special formatting', async () => {
      // Arrange
      const formattedPrompt = `
        # Task
        Please analyze the following:

        ## Data
        - Item 1
        - Item 2

        **Important**: Focus on accuracy.
      `;
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateText(formattedPrompt);

      // Assert
      expect(result.provider).toBe('anthropic');
      expect(result.content).toBe('Claude generated response');
    });

    it('should handle API authentication errors', async () => {
      // Arrange
      const authError = new Error('Invalid API key');
      authError.name = 'AuthenticationError';
      mockChatModel.invoke.mockRejectedValue(authError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Invalid API key');
    });

    it('should handle content policy violations', async () => {
      // Arrange
      const policyError = new Error('Content violates usage policy');
      mockChatModel.invoke.mockRejectedValue(policyError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Content violates usage policy');
    });

    it('should handle model overload errors', async () => {
      // Arrange
      const overloadError = new Error('Model is overloaded, please try again');
      overloadError.name = 'OverloadError';
      mockChatModel.invoke.mockRejectedValue(overloadError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Model is overloaded, please try again');
    });

    it('should handle context length exceeded errors', async () => {
      // Arrange
      const contextError = new Error('Input too long for context window');
      mockChatModel.invoke.mockRejectedValue(contextError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Input too long for context window');
    });

    it('should handle network timeout gracefully', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockChatModel.invoke.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(provider.generateText('test')).rejects.toThrow('Request timeout');
    });

    it('should handle empty message array', async () => {
      // Arrange
      const messages: LLMMessage[] = [];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      const result = await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith([], {});
      expect(result.content).toBe('Claude generated response');
    });
  });

  describe('message role mapping', () => {
    beforeEach(() => {
      (provider as any).apiKey = mockApiKey;
    });

    it('should correctly map all message roles', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [
          expect.objectContaining({ content: 'System message', type: 'system' }),
          expect.objectContaining({ content: 'User message', type: 'human' }),
          expect.objectContaining({ content: 'Assistant message', type: 'ai' }),
        ],
        {}
      );
    });

    it('should handle multiple consecutive messages of same role', async () => {
      // Arrange
      const messages: LLMMessage[] = [
        { role: 'user', content: 'First user message' },
        { role: 'user', content: 'Second user message' },
        { role: 'assistant', content: 'Assistant response' },
      ];
      mockChatModel.invoke.mockResolvedValue(mockGenerationResponse);

      // Act
      await provider.generateChat(messages);

      // Assert
      expect(mockChatModel.invoke).toHaveBeenCalledWith(
        [
          expect.objectContaining({ content: 'First user message', type: 'human' }),
          expect.objectContaining({ content: 'Second user message', type: 'human' }),
          expect.objectContaining({ content: 'Assistant response', type: 'ai' }),
        ],
        {}
      );
    });
  });
});