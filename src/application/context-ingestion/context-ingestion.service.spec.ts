import { Test, TestingModule } from '@nestjs/testing';
import { ContextIngestionService } from './context-ingestion.service';
import { VectorDbService } from '@core/vector-db';
import { MonitoringService } from '@core/monitoring';
import { TextProcessor } from './processors/text-processor';
import { ImageProcessor } from './processors/image-processor';
import {
  ProcessedContext,
  ContextEnhancement,
  ContextProcessingOptions,
  ImageAnalysisResult,
} from './interfaces/context-ingestion.interface';

describe('ContextIngestionService', () => {
  let service: ContextIngestionService;
  let vectorDbService: jest.Mocked<VectorDbService>;
  let monitoringService: jest.Mocked<MonitoringService>;
  let textProcessor: jest.Mocked<TextProcessor>;
  let imageProcessor: jest.Mocked<ImageProcessor>;

  const mockProcessedContext: ProcessedContext = {
    summary: 'E-commerce platform with user authentication and product catalog',
    keyRequirements: [
      'User registration and authentication',
      'Product catalog management',
      'Shopping cart functionality',
      'Payment processing',
    ],
    technicalDetails: {
      stack: ['React', 'Node.js', 'PostgreSQL'],
      architecture: 'Microservices',
      integrations: ['Stripe', 'SendGrid'],
      constraints: ['Must support 10k concurrent users'],
      uiComponents: ['Product grid', 'Shopping cart', 'User dashboard'],
    },
    userStories: [
      'As a customer, I want to browse products',
      'As a customer, I want to add items to cart',
      'As an admin, I want to manage product inventory',
    ],
    businessRules: [
      'Free shipping for orders over $50',
      'Users must verify email before purchasing',
    ],
    metadata: {
      wordCount: 150,
      hasImages: false,
      complexity: 'moderate',
      confidence: 0.85,
    },
  };

  const mockImageAnalysis: ImageAnalysisResult = {
    text: ['Login', 'Username', 'Password', 'Submit'],
    uiElements: [
      {
        type: 'input',
        description: 'Username input field',
        position: { x: 100, y: 50 },
      },
      {
        type: 'button',
        description: 'Submit button',
        position: { x: 100, y: 120 },
      },
    ],
    layout: {
      type: 'desktop',
      description: 'Standard login form layout',
    },
    colors: ['#ffffff', '#007bff', '#6c757d'],
    isWireframe: true,
    confidence: 0.92,
  };

  const mockContextEnhancement: ContextEnhancement = {
    relatedSpecifications: [
      {
        id: 'spec-456',
        title: 'E-commerce Mobile App',
        relevance: 0.89,
        insights: ['Similar payment flow', 'Shared user management'],
      },
    ],
    teamKnowledge: [
      {
        title: 'Payment Gateway Best Practices',
        content: 'Use tokenization for security...',
        relevance: 0.76,
      },
    ],
    suggestedTechnologies: ['Redux', 'JWT', 'Docker'],
    commonPatterns: ['Repository pattern', 'Event sourcing'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextIngestionService,
        {
          provide: VectorDbService,
          useValue: {
            searchSimilar: jest.fn(),
            storeDocument: jest.fn(),
            searchTeamKnowledge: jest.fn(),
          },
        },
        {
          provide: MonitoringService,
          useValue: {
            trackPerformance: jest.fn(),
            incrementCounter: jest.fn(),
            logWithContext: jest.fn(),
          },
        },
        {
          provide: TextProcessor,
          useValue: {
            processText: jest.fn(),
          },
        },
        {
          provide: ImageProcessor,
          useValue: {
            processImage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContextIngestionService>(ContextIngestionService);
    vectorDbService = module.get(VectorDbService);
    monitoringService = module.get(MonitoringService);
    textProcessor = module.get(TextProcessor);
    imageProcessor = module.get(ImageProcessor);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all dependencies injected', () => {
      expect(vectorDbService).toBeDefined();
      expect(monitoringService).toBeDefined();
      expect(textProcessor).toBeDefined();
      expect(imageProcessor).toBeDefined();
    });
  });

  describe('processContext', () => {
    const mockInput = {
      text: 'Build an e-commerce platform with user authentication, product catalog, and payment processing',
      userId: 'user-123',
      teamId: 'team-456',
    };

    beforeEach(() => {
      textProcessor.processText.mockResolvedValue(mockProcessedContext);
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });
    });

    it('should process text-only context successfully', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: false,
        includeTeamKnowledge: false,
        enhanceWithAI: true,
      };

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(textProcessor.processText).toHaveBeenCalledWith(mockInput.text, {
        extractUserStories: undefined,
        analyzeComplexity: undefined,
      });
      expect(result.processed).toEqual(mockProcessedContext);
      expect(result.enhancement).toBeUndefined();
      expect(monitoringService.trackPerformance).toHaveBeenCalledWith(
        'context_ingestion',
        expect.any(Function)
      );
    });

    it('should process context with image attachments', async () => {
      // Arrange
      const inputWithImages = {
        ...mockInput,
        attachments: [
          {
            type: 'image' as const,
            data: Buffer.from('fake-image-data'),
            mimeType: 'image/png',
          },
        ],
      };

      imageProcessor.processImage.mockResolvedValue(mockImageAnalysis);

      // Act
      const result = await service.processContext(inputWithImages);

      // Assert
      expect(imageProcessor.processImage).toHaveBeenCalledWith(
        inputWithImages.attachments[0].data,
        'image/png'
      );
      expect(textProcessor.processText).toHaveBeenCalledWith(
        expect.stringContaining(mockInput.text),
        expect.any(Object)
      );
      expect(result.processed.metadata.hasImages).toBe(true);
    });

    it('should enhance context with related specifications', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: true,
        includeTeamKnowledge: false,
      };

      vectorDbService.searchSimilar.mockResolvedValue([
        {
          id: 'spec-456',
          score: 0.89,
          metadata: {
            id: 'spec-456',
            type: 'specification',
            title: 'E-commerce Mobile App',
            createdAt: new Date(),
          },
          content: 'Similar e-commerce specification content',
        },
      ]);

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(vectorDbService.searchSimilar).toHaveBeenCalledWith(
        expect.stringContaining('e-commerce'),
        expect.objectContaining({
          topK: 5,
          filter: { type: 'specification' },
        })
      );
      expect(result.enhancement).toBeDefined();
      expect(result.enhancement?.relatedSpecifications).toHaveLength(1);
    });

    it('should enhance context with team knowledge', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: false,
        includeTeamKnowledge: true,
      };

      vectorDbService.searchTeamKnowledge.mockResolvedValue([
        {
          id: 'knowledge-123',
          score: 0.76,
          metadata: {
            id: 'knowledge-123',
            type: 'knowledge',
            title: 'Payment Gateway Best Practices',
            createdAt: new Date(),
          },
          content: 'Use tokenization for security...',
        },
      ]);

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(vectorDbService.searchTeamKnowledge).toHaveBeenCalledWith(
        mockInput.teamId,
        expect.stringContaining('e-commerce'),
        expect.objectContaining({
          topK: 3,
        })
      );
      expect(result.enhancement?.teamKnowledge).toHaveLength(1);
    });

    it('should store processed context for future use', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: false,
        includeTeamKnowledge: false,
      };

      vectorDbService.storeDocument.mockResolvedValue('doc-123');

      // Act
      await service.processContext(mockInput, options);

      // Assert
      expect(vectorDbService.storeDocument).toHaveBeenCalledWith({
        title: expect.stringContaining('Context'),
        content: mockInput.text,
        type: 'context',
        userId: mockInput.userId,
        teamId: mockInput.teamId,
        metadata: expect.objectContaining({
          processed: true,
          summary: mockProcessedContext.summary,
        }),
      });
    });

    it('should handle processing without user context', async () => {
      // Arrange
      const inputWithoutUser = {
        text: 'Simple requirement text',
      };

      // Act
      const result = await service.processContext(inputWithoutUser);

      // Assert
      expect(textProcessor.processText).toHaveBeenCalledWith(inputWithoutUser.text, expect.any(Object));
      expect(result.processed).toEqual(mockProcessedContext);
      expect(vectorDbService.storeDocument).not.toHaveBeenCalled();
    });

    it('should handle multiple image attachments', async () => {
      // Arrange
      const inputWithMultipleImages = {
        ...mockInput,
        attachments: [
          {
            type: 'image' as const,
            data: Buffer.from('image1'),
            mimeType: 'image/png',
          },
          {
            type: 'image' as const,
            data: Buffer.from('image2'),
            mimeType: 'image/jpeg',
          },
        ],
      };

      imageProcessor.processImage
        .mockResolvedValueOnce(mockImageAnalysis)
        .mockResolvedValueOnce({
          ...mockImageAnalysis,
          text: ['Different UI elements'],
        });

      // Act
      const result = await service.processContext(inputWithMultipleImages);

      // Assert
      expect(imageProcessor.processImage).toHaveBeenCalledTimes(2);
      expect(textProcessor.processText).toHaveBeenCalledWith(
        expect.stringContaining('Login'),
        expect.any(Object)
      );
    });

    it('should pass through text processing options', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        extractUserStories: true,
        analyzeComplexity: true,
      };

      // Act
      await service.processContext(mockInput, options);

      // Assert
      expect(textProcessor.processText).toHaveBeenCalledWith(mockInput.text, {
        extractUserStories: true,
        analyzeComplexity: true,
      });
    });
  });

  describe('Error Handling', () => {
    const mockInput = {
      text: 'Test requirement',
      userId: 'user-123',
      teamId: 'team-456',
    };

    it('should handle text processing errors', async () => {
      // Arrange
      const processingError = new Error('Text processing failed');
      textProcessor.processText.mockRejectedValue(processingError);
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act & Assert
      await expect(service.processContext(mockInput)).rejects.toThrow(processingError);
    });

    it('should handle image processing errors gracefully', async () => {
      // Arrange
      const inputWithImage = {
        ...mockInput,
        attachments: [
          {
            type: 'image' as const,
            data: Buffer.from('corrupted-image'),
            mimeType: 'image/png',
          },
        ],
      };

      imageProcessor.processImage.mockRejectedValue(new Error('Image processing failed'));
      textProcessor.processText.mockResolvedValue(mockProcessedContext);
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await service.processContext(inputWithImage);

      // Assert
      expect(result.processed).toEqual(mockProcessedContext);
      // Should continue processing even if image processing fails
      expect(textProcessor.processText).toHaveBeenCalled();
    });

    it('should handle vector database errors for enhancement', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: true,
      };

      textProcessor.processText.mockResolvedValue(mockProcessedContext);
      vectorDbService.searchSimilar.mockRejectedValue(new Error('Vector DB error'));
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(result.processed).toEqual(mockProcessedContext);
      expect(result.enhancement).toBeUndefined();
      // Should continue processing despite vector DB error
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange
      textProcessor.processText.mockResolvedValue(mockProcessedContext);
      vectorDbService.storeDocument.mockRejectedValue(new Error('Storage failed'));
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await service.processContext(mockInput);

      // Assert
      expect(result.processed).toEqual(mockProcessedContext);
      // Should return result even if storage fails
    });

    it('should handle empty or invalid input text', async () => {
      // Arrange
      const emptyInput = { text: '' };
      const validationError = new Error('Text cannot be empty');
      textProcessor.processText.mockRejectedValue(validationError);
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act & Assert
      await expect(service.processContext(emptyInput)).rejects.toThrow(validationError);
    });

    it('should handle malformed attachment data', async () => {
      // Arrange
      const inputWithBadAttachment = {
        ...mockInput,
        attachments: [
          {
            type: 'image' as const,
            data: null as any,
            mimeType: 'image/png',
          },
        ],
      };

      imageProcessor.processImage.mockRejectedValue(new Error('Invalid image data'));
      textProcessor.processText.mockResolvedValue(mockProcessedContext);
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await service.processContext(inputWithBadAttachment);

      // Assert
      expect(result.processed).toEqual(mockProcessedContext);
      // Should handle bad attachment gracefully
    });
  });

  describe('Performance and Monitoring', () => {
    const mockInput = {
      text: 'Performance test requirement',
      userId: 'user-123',
    };

    beforeEach(() => {
      textProcessor.processText.mockResolvedValue(mockProcessedContext);
    });

    it('should track performance metrics', async () => {
      // Arrange
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await service.processContext(mockInput);

      // Assert
      expect(monitoringService.trackPerformance).toHaveBeenCalledWith(
        'context_ingestion',
        expect.any(Function)
      );
    });

    it('should increment processing counters', async () => {
      // Arrange
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await service.processContext(mockInput);

      // Assert
      expect(monitoringService.incrementCounter).toHaveBeenCalledWith(
        'context_processed',
        1,
        expect.objectContaining({
          hasImages: 'false',
          complexity: mockProcessedContext.metadata.complexity,
        })
      );
    });

    it('should log context processing events', async () => {
      // Arrange
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await service.processContext(mockInput);

      // Assert
      expect(monitoringService.logWithContext).toHaveBeenCalledWith(
        'log',
        'Context processed successfully',
        expect.objectContaining({
          userId: mockInput.userId,
          wordCount: mockProcessedContext.metadata.wordCount,
          complexity: mockProcessedContext.metadata.complexity,
        })
      );
    });

    it('should handle concurrent processing requests', async () => {
      // Arrange
      const concurrentInputs = Array.from({ length: 5 }, (_, i) => ({
        text: `Concurrent requirement ${i}`,
        userId: `user-${i}`,
      }));

      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const promises = concurrentInputs.map(input => service.processContext(input));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      expect(textProcessor.processText).toHaveBeenCalledTimes(5);
      expect(monitoringService.trackPerformance).toHaveBeenCalledTimes(5);
    });

    it('should measure processing time for large inputs', async () => {
      // Arrange
      const largeInput = {
        text: 'Large requirement text '.repeat(1000),
        userId: 'user-123',
      };

      let processingDuration = 0;
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        const startTime = Date.now();
        const result = await fn();
        processingDuration = Date.now() - startTime;
        return result;
      });

      // Act
      await service.processContext(largeInput);

      // Assert
      expect(processingDuration).toBeGreaterThan(0);
      expect(textProcessor.processText).toHaveBeenCalledWith(
        largeInput.text,
        expect.any(Object)
      );
    });
  });

  describe('Context Enhancement Features', () => {
    const mockInput = {
      text: 'E-commerce platform requirement',
      userId: 'user-123',
      teamId: 'team-456',
    };

    beforeEach(() => {
      textProcessor.processText.mockResolvedValue(mockProcessedContext);
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });
    });

    it('should build comprehensive context enhancement', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: true,
        includeTeamKnowledge: true,
      };

      vectorDbService.searchSimilar.mockResolvedValue([
        {
          id: 'spec-456',
          score: 0.89,
          metadata: {
            id: 'spec-456',
            type: 'specification',
            title: 'E-commerce Mobile App',
            tags: ['mobile', 'ecommerce'],
            createdAt: new Date(),
          },
          content: 'Mobile e-commerce app specification',
        },
      ]);

      vectorDbService.searchTeamKnowledge.mockResolvedValue([
        {
          id: 'knowledge-123',
          score: 0.76,
          metadata: {
            id: 'knowledge-123',
            type: 'knowledge',
            title: 'Payment Gateway Best Practices',
            createdAt: new Date(),
          },
          content: 'Payment security guidelines...',
        },
      ]);

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(result.enhancement).toBeDefined();
      expect(result.enhancement?.relatedSpecifications).toHaveLength(1);
      expect(result.enhancement?.teamKnowledge).toHaveLength(1);
      expect(result.enhancement?.relatedSpecifications[0]).toEqual({
        id: 'spec-456',
        title: 'E-commerce Mobile App',
        relevance: 0.89,
        insights: expect.any(Array),
      });
    });

    it('should generate technology suggestions based on context', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: true,
      };

      vectorDbService.searchSimilar.mockResolvedValue([
        {
          id: 'spec-react',
          score: 0.85,
          metadata: {
            id: 'spec-react',
            type: 'specification',
            title: 'React E-commerce Platform',
            tags: ['react', 'ecommerce', 'nodejs'],
            createdAt: new Date(),
          },
          content: 'React-based e-commerce solution',
        },
      ]);

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(result.enhancement?.suggestedTechnologies).toContain('react');
      expect(result.enhancement?.commonPatterns).toBeDefined();
    });

    it('should handle empty enhancement results', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: true,
        includeTeamKnowledge: true,
      };

      vectorDbService.searchSimilar.mockResolvedValue([]);
      vectorDbService.searchTeamKnowledge.mockResolvedValue([]);

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(result.enhancement).toBeDefined();
      expect(result.enhancement?.relatedSpecifications).toEqual([]);
      expect(result.enhancement?.teamKnowledge).toEqual([]);
    });

    it('should filter low-relevance enhancement results', async () => {
      // Arrange
      const options: ContextProcessingOptions = {
        includeRelatedSpecs: true,
      };

      vectorDbService.searchSimilar.mockResolvedValue([
        {
          id: 'spec-high',
          score: 0.89,
          metadata: {
            id: 'spec-high',
            type: 'specification',
            title: 'High Relevance Spec',
            createdAt: new Date(),
          },
          content: 'Highly relevant content',
        },
        {
          id: 'spec-low',
          score: 0.15,
          metadata: {
            id: 'spec-low',
            type: 'specification',
            title: 'Low Relevance Spec',
            createdAt: new Date(),
          },
          content: 'Barely relevant content',
        },
      ]);

      // Act
      const result = await service.processContext(mockInput, options);

      // Assert
      expect(result.enhancement?.relatedSpecifications).toHaveLength(1);
      expect(result.enhancement?.relatedSpecifications[0].id).toBe('spec-high');
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(() => {
      textProcessor.processText.mockResolvedValue(mockProcessedContext);
      monitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });
    });

    it('should handle memory efficiently with large context inputs', async () => {
      // Arrange
      const largeInput = {
        text: 'Large context input '.repeat(10000),
        userId: 'user-123',
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Act
      await service.processContext(largeInput);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be reasonable (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });

    it('should clean up resources after processing', async () => {
      // Arrange
      const inputWithImages = {
        text: 'Test with image',
        attachments: [
          {
            type: 'image' as const,
            data: Buffer.alloc(1024 * 1024), // 1MB buffer
            mimeType: 'image/png',
          },
        ],
      };

      imageProcessor.processImage.mockResolvedValue(mockImageAnalysis);

      // Act
      await service.processContext(inputWithImages);

      // Assert - Should complete without memory leaks
      expect(imageProcessor.processImage).toHaveBeenCalled();
      expect(textProcessor.processText).toHaveBeenCalled();
    });
  });
});