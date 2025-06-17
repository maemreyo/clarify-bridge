import { Test, TestingModule } from '@nestjs/testing';
import { TextProcessor } from './text-processor';
import { LlmCoreService } from '@core/llm';
import { ProcessedContext } from '../interfaces/context-ingestion.interface';

describe('TextProcessor', () => {
  let processor: TextProcessor;
  let llmService: jest.Mocked<LlmCoreService>;

  const mockAIResponse = {
    content: JSON.stringify({
      summary: 'E-commerce platform with user authentication and product management',
      keyRequirements: [
        'User registration and login',
        'Product catalog management',
        'Shopping cart functionality',
        'Payment processing integration',
      ],
      technicalDetails: {
        stack: ['React', 'Node.js', 'PostgreSQL'],
        architecture: 'Microservices',
        integrations: ['Stripe', 'SendGrid'],
        constraints: ['Must support 10k concurrent users'],
        uiComponents: ['Product grid', 'User dashboard'],
      },
      userStories: [
        'As a customer, I want to browse products',
        'As a customer, I want to add items to cart',
        'As an admin, I want to manage inventory',
      ],
      businessRules: ['Free shipping for orders over $50', 'Email verification required'],
    }),
    usage: { totalTokens: 500 },
    model: 'gpt-4',
    provider: 'openai',
  };

  const mockEntityExtractionResponse = {
    content: JSON.stringify({
      entities: ['User', 'Product', 'Order', 'Admin'],
      concepts: ['Authentication', 'Shopping Cart', 'Payment Processing'],
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
    }),
    usage: { totalTokens: 200 },
    model: 'gpt-4',
    provider: 'openai',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextProcessor,
        {
          provide: LlmCoreService,
          useValue: {
            generateFromTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<TextProcessor>(TextProcessor);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(processor).toBeDefined();
    });

    it('should have LlmCoreService injected', () => {
      expect(llmService).toBeDefined();
    });
  });

  describe('processText', () => {
    const inputText = `
      Build an e-commerce platform with the following requirements:
      - User registration and authentication
      - Product catalog with search functionality
      - Shopping cart and checkout process
      - Payment integration with Stripe
      - Admin dashboard for inventory management

      Technical requirements:
      - Must use React for frontend
      - Node.js backend with Express
      - PostgreSQL database
      - Must support 10,000 concurrent users
      - Mobile responsive design required
    `;

    beforeEach(() => {
      llmService.generateFromTemplate.mockResolvedValue(mockAIResponse);
    });

    it('should process text successfully with AI enhancement', async () => {
      // Act
      const result = await processor.processText(inputText);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('requirements analyst expert'),
          user: expect.stringContaining(inputText.trim()),
        }),
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 2000,
        }),
      );

      expect(result).toEqual({
        summary: 'E-commerce platform with user authentication and product management',
        keyRequirements: [
          'User registration and login',
          'Product catalog management',
          'Shopping cart functionality',
          'Payment processing integration',
        ],
        technicalDetails: {
          stack: ['React', 'Node.js', 'PostgreSQL'],
          architecture: 'Microservices',
          integrations: ['Stripe', 'SendGrid'],
          constraints: ['Must support 10k concurrent users'],
          uiComponents: ['Product grid', 'User dashboard'],
        },
        userStories: [
          'As a customer, I want to browse products',
          'As a customer, I want to add items to cart',
          'As an admin, I want to manage inventory',
        ],
        businessRules: ['Free shipping for orders over $50', 'Email verification required'],
        metadata: {
          wordCount: expect.any(Number),
          hasImages: false,
          complexity: expect.stringMatching(/^(simple|moderate|complex)$/),
          confidence: expect.any(Number),
        },
      });
    });

    it('should process text with user story extraction option', async () => {
      // Arrange
      const options = { extractUserStories: true };

      // Act
      await processor.processText(inputText, options);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('user stories'),
        }),
        expect.any(Object),
      );
    });

    it('should process text with complexity analysis option', async () => {
      // Arrange
      const options = { analyzeComplexity: true };

      // Act
      await processor.processText(inputText, options);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('complexity'),
        }),
        expect.any(Object),
      );
    });

    it('should handle AI processing errors gracefully', async () => {
      // Arrange
      const aiError = new Error('AI service unavailable');
      llmService.generateFromTemplate.mockRejectedValue(aiError);

      // Act
      const result = await processor.processText(inputText);

      // Assert
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.keyRequirements).toBeInstanceOf(Array);
      expect(result.metadata.confidence).toBeLessThan(0.5); // Lower confidence for basic extraction
    });

    it('should fallback to basic extraction when AI fails', async () => {
      // Arrange
      llmService.generateFromTemplate.mockRejectedValue(new Error('AI failed'));

      // Act
      const result = await processor.processText(inputText);

      // Assert
      expect(result.technicalDetails.stack).toContain('react');
      expect(result.technicalDetails.stack).toContain('node');
      expect(result.technicalDetails.stack).toContain('postgresql');
    });

    it('should handle empty text input', async () => {
      // Arrange
      const emptyText = '';

      // Act
      const result = await processor.processText(emptyText);

      // Assert
      expect(result.metadata.wordCount).toBe(0);
      expect(result.metadata.complexity).toBe('simple');
    });

    it('should handle very long text input', async () => {
      // Arrange
      const longText = 'Long requirement text '.repeat(1000);

      // Act
      const result = await processor.processText(longText);

      // Assert
      expect(result.metadata.wordCount).toBeGreaterThan(2000);
      expect(result.metadata.complexity).toBe('complex');
    });

    it('should preprocess text correctly', async () => {
      // Arrange
      const messyText = `  Build   an    app

      with    multiple    spaces  `;

      // Act
      await processor.processText(messyText);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.not.stringContaining('   '), // No triple spaces
        }),
        expect.any(Object),
      );
    });
  });

  describe('extractEntities', () => {
    const inputText =
      'Build a React app with Node.js backend and PostgreSQL database for user management';

    beforeEach(() => {
      llmService.generateFromTemplate.mockResolvedValue(mockEntityExtractionResponse);
    });

    it('should extract entities, concepts, and technologies', async () => {
      // Act
      const result = await processor.extractEntities(inputText);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('requirements analyst expert'),
          user: expect.stringContaining('Extract and categorize'),
        }),
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 1000,
        }),
      );

      expect(result).toEqual({
        entities: ['User', 'Product', 'Order', 'Admin'],
        concepts: ['Authentication', 'Shopping Cart', 'Payment Processing'],
        technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
      });
    });

    it('should handle entity extraction errors', async () => {
      // Arrange
      llmService.generateFromTemplate.mockRejectedValue(new Error('Entity extraction failed'));

      // Act
      const result = await processor.extractEntities(inputText);

      // Assert
      expect(result).toEqual({
        entities: [],
        concepts: [],
        technologies: [],
      });
    });

    it('should handle malformed AI response', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue({
        content: 'Invalid JSON response',
        usage: { totalTokens: 100 },
        model: 'gpt-4',
        provider: 'openai',
      });

      // Act
      const result = await processor.extractEntities(inputText);

      // Assert
      expect(result).toEqual({
        entities: [],
        concepts: [],
        technologies: [],
      });
    });

    it('should handle partial AI response', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue({
        content: JSON.stringify({
          entities: ['User', 'Product'],
          // Missing concepts and technologies
        }),
        usage: { totalTokens: 100 },
        model: 'gpt-4',
        provider: 'openai',
      });

      // Act
      const result = await processor.extractEntities(inputText);

      // Assert
      expect(result.entities).toEqual(['User', 'Product']);
      expect(result.concepts).toEqual([]);
      expect(result.technologies).toEqual([]);
    });
  });

  describe('summarizeText', () => {
    const longText = `
      This is a very long text about building an e-commerce platform. The platform should include user authentication,
      product catalog management, shopping cart functionality, payment processing, and administrative features.
      The technical requirements include using React for the frontend, Node.js for the backend, and PostgreSQL for the database.
      The system must be scalable to support thousands of concurrent users and should be mobile responsive.
    `.repeat(5);

    beforeEach(() => {
      llmService.generateFromTemplate.mockResolvedValue({
        content:
          'Concise summary of e-commerce platform requirements including authentication, catalog, cart, and payment features.',
        usage: { totalTokens: 150 },
        model: 'gpt-4',
        provider: 'openai',
      });
    });

    it('should summarize long text successfully', async () => {
      // Act
      const result = await processor.summarizeText(longText, 500);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('technical documentation expert'),
          user: expect.stringContaining('100 words'),
        }),
        expect.objectContaining({
          temperature: 0.4,
          maxTokens: expect.any(Number),
        }),
      );

      expect(result).toBe(
        'Concise summary of e-commerce platform requirements including authentication, catalog, cart, and payment features.',
      );
    });

    it('should return original text if already short enough', async () => {
      // Arrange
      const shortText = 'Short text';

      // Act
      const result = await processor.summarizeText(shortText, 500);

      // Assert
      expect(result).toBe(shortText);
      expect(llmService.generateFromTemplate).not.toHaveBeenCalled();
    });

    it('should handle summarization errors with fallback', async () => {
      // Arrange
      llmService.generateFromTemplate.mockRejectedValue(new Error('Summarization failed'));

      // Act
      const result = await processor.summarizeText(longText, 100);

      // Assert
      expect(result).toBe(longText.substring(0, 100) + '...');
    });

    it('should adjust token limit based on max length', async () => {
      // Arrange
      const maxLength = 200;

      // Act
      await processor.summarizeText(longText, maxLength);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxTokens: Math.floor(maxLength / 4),
        }),
      );
    });

    it('should handle custom max length parameters', async () => {
      // Arrange
      const customMaxLength = 1000;

      // Act
      await processor.summarizeText(longText, customMaxLength);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('200 words'), // maxLength / 5
        }),
        expect.any(Object),
      );
    });
  });

  describe('Private Helper Methods', () => {
    describe('preprocessText', () => {
      it('should normalize whitespace and newlines', () => {
        // Arrange
        const messyText = `  Text  with   multiple    spaces

        and    many    newlines  `;

        // Act
        const result = (processor as any).preprocessText(messyText);

        // Assert
        expect(result).toBe('Text with multiple spaces\n\nand many newlines');
      });

      it('should trim leading and trailing whitespace', () => {
        // Arrange
        const text = '   Clean text   ';

        // Act
        const result = (processor as any).preprocessText(text);

        // Assert
        expect(result).toBe('Clean text');
      });

      it('should handle empty text', () => {
        // Act
        const result = (processor as any).preprocessText('');

        // Assert
        expect(result).toBe('');
      });
    });

    describe('parseAIResponse', () => {
      it('should parse valid JSON response', () => {
        // Arrange
        const jsonResponse =
          'Some text before {"key": "value", "array": [1, 2, 3]} some text after';

        // Act
        const result = (processor as any).parseAIResponse(jsonResponse);

        // Assert
        expect(result).toEqual({ key: 'value', array: [1, 2, 3] });
      });

      it('should handle malformed JSON', () => {
        // Arrange
        const invalidJson = 'This is not JSON at all';

        // Act
        const result = (processor as any).parseAIResponse(invalidJson);

        // Assert
        expect(result).toBeNull();
      });

      it('should handle incomplete JSON', () => {
        // Arrange
        const incompleteJson = '{"incomplete": "json"';

        // Act
        const result = (processor as any).parseAIResponse(incompleteJson);

        // Assert
        expect(result).toBeNull();
      });

      it('should extract first JSON object if multiple exist', () => {
        // Arrange
        const multipleJson = 'Text {"first": 1} more text {"second": 2}';

        // Act
        const result = (processor as any).parseAIResponse(multipleJson);

        // Assert
        expect(result).toEqual({ first: 1 });
      });
    });

    describe('analyzeComplexity', () => {
      it('should classify simple complexity', () => {
        // Arrange
        const extracted = {
          keyRequirements: ['Req1', 'Req2'],
          technicalDetails: { stack: ['React'] },
        };

        // Act
        const result = (processor as any).analyzeComplexity(100, extracted);

        // Assert
        expect(result).toBe('simple');
      });

      it('should classify moderate complexity', () => {
        // Arrange
        const extracted = {
          keyRequirements: ['Req1', 'Req2', 'Req3', 'Req4', 'Req5', 'Req6'],
          technicalDetails: {
            stack: ['React', 'Node.js', 'PostgreSQL'],
            integrations: ['Stripe'],
          },
        };

        // Act
        const result = (processor as any).analyzeComplexity(300, extracted);

        // Assert
        expect(result).toBe('moderate');
      });

      it('should classify complex complexity', () => {
        // Arrange
        const extracted = {
          keyRequirements: Array.from({ length: 15 }, (_, i) => `Req${i}`),
          technicalDetails: {
            stack: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes'],
            integrations: ['Stripe', 'SendGrid', 'AWS', 'Firebase'],
          },
        };

        // Act
        const result = (processor as any).analyzeComplexity(600, extracted);

        // Assert
        expect(result).toBe('complex');
      });

      it('should handle missing extracted data', () => {
        // Act
        const result = (processor as any).analyzeComplexity(50, {});

        // Assert
        expect(result).toBe('simple');
      });
    });

    describe('calculateConfidence', () => {
      it('should calculate high confidence with complete data', () => {
        // Arrange
        const extracted = {
          summary: 'Complete summary',
          keyRequirements: ['Req1', 'Req2', 'Req3'],
          technicalDetails: { stack: ['React', 'Node.js'] },
          userStories: ['Story1', 'Story2'],
        };

        // Act
        const result = (processor as any).calculateConfidence(extracted);

        // Assert
        expect(result).toBe(1.0); // 0.5 + 0.1 + 0.2 + 0.1 + 0.1 = 1.0
      });

      it('should calculate low confidence with minimal data', () => {
        // Arrange
        const extracted = {};

        // Act
        const result = (processor as any).calculateConfidence(extracted);

        // Assert
        expect(result).toBe(0.5); // Base confidence only
      });

      it('should cap confidence at 1.0', () => {
        // Arrange
        const extracted = {
          summary: 'Summary',
          keyRequirements: ['Req1'],
          technicalDetails: { stack: ['React'] },
          userStories: ['Story1'],
          extraField: 'Extra', // This shouldn't increase confidence beyond 1.0
        };

        // Act
        const result = (processor as any).calculateConfidence(extracted);

        // Assert
        expect(result).toBe(1.0);
      });
    });

    describe('extractTechnologies', () => {
      it('should extract known technologies from text', () => {
        // Arrange
        const text =
          'Build with React and Node.js, use PostgreSQL database, deploy to AWS with Docker';

        // Act
        const result = (processor as any).extractTechnologies(text);

        // Assert
        expect(result).toContain('react');
        expect(result).toContain('node');
        expect(result).toContain('postgresql');
        expect(result).toContain('aws');
        expect(result).toContain('docker');
      });

      it('should handle case-insensitive matching', () => {
        // Arrange
        const text = 'Use REACT and NODE.JS with PostgreSQL';

        // Act
        const result = (processor as any).extractTechnologies(text);

        // Assert
        expect(result).toContain('react');
        expect(result).toContain('node');
        expect(result).toContain('postgresql');
      });

      it('should return empty array for text without technologies', () => {
        // Arrange
        const text = 'Simple text without any technology keywords';

        // Act
        const result = (processor as any).extractTechnologies(text);

        // Assert
        expect(result).toEqual([]);
      });

      it('should not duplicate technologies', () => {
        // Arrange
        const text = 'React app with React components using React hooks';

        // Act
        const result = (processor as any).extractTechnologies(text);

        // Assert
        expect(result.filter(tech => tech === 'react')).toHaveLength(1);
      });
    });

    describe('extractConstraints', () => {
      it('should extract constraints from text', () => {
        // Arrange
        const text = `
          Constraint: Must support 10k users
          The system must not store passwords in plain text
          Limitation: Cannot use third-party libraries
        `;

        // Act
        const result = (processor as any).extractConstraints(text);

        // Assert
        expect(result).toContain('Must support 10k users');
        expect(result).toContain('store passwords in plain text');
        expect(result).toContain('Cannot use third-party libraries');
      });

      it('should handle different constraint patterns', () => {
        // Arrange
        const text = `
          Restriction: No external APIs
          Should not exceed 5MB memory usage
          Cannot connect to external databases
        `;

        // Act
        const result = (processor as any).extractConstraints(text);

        // Assert
        expect(result.length).toBeGreaterThan(0);
      });

      it('should return empty array when no constraints found', () => {
        // Arrange
        const text = 'Simple requirements without any constraints';

        // Act
        const result = (processor as any).extractConstraints(text);

        // Assert
        expect(result).toEqual([]);
      });

      it('should remove duplicate constraints', () => {
        // Arrange
        const text = `
          Must not exceed memory limit
          Constraint: Must not exceed memory limit
        `;

        // Act
        const result = (processor as any).extractConstraints(text);

        // Assert
        expect(result.filter(c => c.includes('exceed memory limit'))).toHaveLength(1);
      });
    });

    describe('generateBasicSummary', () => {
      it('should generate summary from first few sentences', () => {
        // Arrange
        const text = 'First sentence. Second sentence! Third sentence? Fourth sentence.';

        // Act
        const result = (processor as any).generateBasicSummary(text);

        // Assert
        expect(result).toBe('First sentence. Second sentence! Third sentence?');
      });

      it('should handle text with no sentence endings', () => {
        // Arrange
        const text = 'Text without proper sentence endings';

        // Act
        const result = (processor as any).generateBasicSummary(text);

        // Assert
        expect(result).toBe('');
      });

      it('should handle empty text', () => {
        // Act
        const result = (processor as any).generateBasicSummary('');

        // Assert
        expect(result).toBe('');
      });

      it('should trim whitespace from summary', () => {
        // Arrange
        const text = '  First sentence.  Second sentence!  ';

        // Act
        const result = (processor as any).generateBasicSummary(text);

        // Assert
        expect(result).toBe('First sentence.  Second sentence!');
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very large text efficiently', async () => {
      // Arrange
      const largeText = 'Large text content '.repeat(10000);
      llmService.generateFromTemplate.mockResolvedValue(mockAIResponse);

      const startTime = Date.now();

      // Act
      const result = await processor.processText(largeText);

      const endTime = Date.now();

      // Assert
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent processing requests', async () => {
      // Arrange
      const texts = Array.from({ length: 5 }, (_, i) => `Concurrent text ${i}`);
      llmService.generateFromTemplate.mockResolvedValue(mockAIResponse);

      // Act
      const promises = texts.map(text => processor.processText(text));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.metadata).toBeDefined();
      });
    });

    it('should handle text with special characters and encoding', async () => {
      // Arrange
      const specialText = 'Text with émojis 🚀, üñíçødé characters, and special symbols: @#$%^&*()';
      llmService.generateFromTemplate.mockResolvedValue(mockAIResponse);

      // Act
      const result = await processor.processText(specialText);

      // Assert
      expect(result).toBeDefined();
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should not leak memory with repeated processing', async () => {
      // Arrange
      const testText = 'Memory test text for processing';
      llmService.generateFromTemplate.mockResolvedValue(mockAIResponse);
      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Process text multiple times
      for (let i = 0; i < 50; i++) {
        await processor.processText(testText);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle null and undefined gracefully', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockAIResponse);

      // Act & Assert - Should not throw errors
      await expect(processor.processText(null as any)).rejects.toThrow();
      await expect(processor.processText(undefined as any)).rejects.toThrow();
    });
  });

  describe('Integration with AI Service', () => {
    it('should properly format prompts for different AI models', async () => {
      // Arrange
      const text = 'Test requirement text';

      // Act
      await processor.processText(text);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('requirements analyst'),
          user: expect.stringContaining(text),
        }),
        expect.objectContaining({
          temperature: expect.any(Number),
          maxTokens: expect.any(Number),
        }),
      );
    });

    it('should handle different AI model responses', async () => {
      // Arrange
      const differentModelResponse = {
        content: '{"summary": "Different model response", "keyRequirements": ["Req1"]}',
        usage: { totalTokens: 300 },
        model: 'claude-3',
        provider: 'anthropic',
      };

      llmService.generateFromTemplate.mockResolvedValue(differentModelResponse);

      // Act
      const result = await processor.processText('Test text');

      // Assert
      expect(result.summary).toBe('Different model response');
      expect(result.keyRequirements).toEqual(['Req1']);
    });
  });
});
