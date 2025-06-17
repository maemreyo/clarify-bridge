// Test multi-view generation orchestration service

import { Test, TestingModule } from '@nestjs/testing';
import { MultiViewGenerationService } from './multi-view-generation.service';
import { MonitoringService } from '@core/monitoring';
import { PmViewGenerator } from './generators/pm-view.generator';
import { FrontendViewGenerator } from './generators/frontend-view.generator';
import { BackendViewGenerator } from './generators/backend-view.generator';
import {
  ViewGenerationContext,
  ViewGenerationResult,
  ViewGeneratorOptions,
} from './interfaces/view-generation.interface';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';
import { ProcessedContext } from '@application/context-ingestion';

describe('MultiViewGenerationService', () => {
  let service: MultiViewGenerationService;
  let monitoringService: jest.Mocked<MonitoringService>;
  let pmViewGenerator: jest.Mocked<PmViewGenerator>;
  let frontendViewGenerator: jest.Mocked<FrontendViewGenerator>;
  let backendViewGenerator: jest.Mocked<BackendViewGenerator>;

  // Mock data
  const mockProcessedContext: ProcessedContext = {
    summary: 'E-commerce platform requirements analysis',
    keyRequirements: [
      'User authentication and authorization',
      'Product catalog management',
      'Shopping cart and checkout',
      'Payment processing',
    ],
    technicalDetails: {
      stack: ['React', 'Node.js', 'PostgreSQL', 'Redis'],
      architecture: 'Microservices',
      integrations: ['Stripe', 'SendGrid'],
      constraints: ['Must support 1000 concurrent users'],
      uiComponents: ['Header', 'Product Grid', 'Shopping Cart'],
    },
    userStories: [
      'As a customer, I want to browse products',
      'As a customer, I want to add items to cart',
      'As an admin, I want to manage inventory',
    ],
    businessRules: [
      'Only registered users can make purchases',
      'Inventory must be real-time updated',
    ],
    metadata: {
      wordCount: 500,
      hasImages: false,
      complexity: 'moderate',
      confidence: 0.85,
    },
  };

  const mockViewGenerationContext: ViewGenerationContext = {
    processed: mockProcessedContext,
    originalRequirements: 'Build a comprehensive e-commerce platform',
    options: {
      detailLevel: 'detailed',
      includeExamples: true,
      generateDiagrams: false,
    },
  };

  const mockPmView = {
    overview: 'E-commerce platform overview',
    userStories: [
      {
        id: 'US001',
        title: 'Browse Products',
        description: 'Customer can view product catalog',
        acceptanceCriteria: ['Product list displays', 'Filtering works'],
        priority: 'High',
      },
    ],
    features: [
      {
        id: 'F001',
        name: 'Product Catalog',
        description: 'Product browsing functionality',
        requirements: ['Display products', 'Search functionality'],
      },
    ],
    businessRules: mockProcessedContext.businessRules,
  };

  const mockFrontendView = {
    components: [
      {
        name: 'ProductGrid',
        type: 'component',
        description: 'Displays product catalog',
        props: ['products', 'onProductClick'],
      },
    ],
    pages: [
      {
        name: 'HomePage',
        path: '/',
        description: 'Main landing page',
        components: ['Header', 'ProductGrid', 'Footer'],
      },
    ],
    stateManagement: {
      type: 'Redux',
      slices: ['products', 'cart', 'user'],
    },
    routing: [
      { path: '/', component: 'HomePage' },
      { path: '/product/:id', component: 'ProductDetailPage' },
    ],
  };

  const mockBackendView = {
    apis: [
      {
        endpoint: '/api/products',
        method: 'GET',
        description: 'Get all products',
        responses: {
          200: { description: 'Success', schema: 'ProductList' },
        },
      },
    ],
    dataModels: [
      {
        name: 'Product',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
        ],
      },
    ],
    services: [
      {
        name: 'ProductService',
        methods: ['getAllProducts', 'getProductById', 'createProduct'],
        dependencies: ['ProductRepository'],
      },
    ],
    infrastructure: {
      database: 'PostgreSQL',
      cache: 'Redis',
      queue: 'Bull',
    },
  };

  const mockGeneratedViews: GeneratedViews = {
    pmView: mockPmView,
    frontendView: mockFrontendView,
    backendView: mockBackendView,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiViewGenerationService,
        {
          provide: MonitoringService,
          useValue: {
            trackAiGeneration: jest.fn(),
          },
        },
        {
          provide: PmViewGenerator,
          useValue: {
            generatePmView: jest.fn(),
          },
        },
        {
          provide: FrontendViewGenerator,
          useValue: {
            generateFrontendView: jest.fn(),
          },
        },
        {
          provide: BackendViewGenerator,
          useValue: {
            generateBackendView: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MultiViewGenerationService>(MultiViewGenerationService);
    monitoringService = module.get(MonitoringService);
    pmViewGenerator = module.get(PmViewGenerator);
    frontendViewGenerator = module.get(FrontendViewGenerator);
    backendViewGenerator = module.get(BackendViewGenerator);

    jest.clearAllMocks();
  });

  describe('generateAllViews', () => {
    it('should generate all views sequentially by default', async () => {
      // Arrange
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);
      frontendViewGenerator.generateFrontendView.mockResolvedValue(mockFrontendView);
      backendViewGenerator.generateBackendView.mockResolvedValue(mockBackendView);

      // Act
      const result = await service.generateAllViews(mockViewGenerationContext);

      // Assert
      expect(pmViewGenerator.generatePmView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        expect.objectContaining({
          detailLevel: 'detailed',
          includeExamples: true,
        }),
      );
      expect(frontendViewGenerator.generateFrontendView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        expect.objectContaining({
          detailLevel: 'detailed',
          includeExamples: true,
        }),
      );
      expect(backendViewGenerator.generateBackendView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        expect.objectContaining({
          detailLevel: 'detailed',
          includeExamples: true,
        }),
      );

      expect(result.views).toEqual(mockGeneratedViews);
      expect(result.metadata.generationTime).toBeGreaterThan(0);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeGreaterThan(0);
      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'multi_view_generation',
        expect.any(Number),
        true,
        expect.objectContaining({ tokens: expect.any(Number) }),
      );
    });

    it('should generate views in parallel when specified', async () => {
      // Arrange
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);
      frontendViewGenerator.generateFrontendView.mockResolvedValue(mockFrontendView);
      backendViewGenerator.generateBackendView.mockResolvedValue(mockBackendView);

      // Act
      const result = await service.generateAllViews(mockViewGenerationContext, {
        parallel: true,
      });

      // Assert
      expect(result.views).toEqual(mockGeneratedViews);
      expect(pmViewGenerator.generatePmView).toHaveBeenCalled();
      expect(frontendViewGenerator.generateFrontendView).toHaveBeenCalled();
      expect(backendViewGenerator.generateBackendView).toHaveBeenCalled();
    });

    it('should generate only specified views', async () => {
      // Arrange
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);
      frontendViewGenerator.generateFrontendView.mockResolvedValue(mockFrontendView);

      // Act
      const result = await service.generateAllViews(mockViewGenerationContext, {
        views: ['pm', 'frontend'],
      });

      // Assert
      expect(pmViewGenerator.generatePmView).toHaveBeenCalled();
      expect(frontendViewGenerator.generateFrontendView).toHaveBeenCalled();
      expect(backendViewGenerator.generateBackendView).not.toHaveBeenCalled();

      expect(result.views.pmView).toEqual(mockPmView);
      expect(result.views.frontendView).toEqual(mockFrontendView);
      expect(result.views.backendView).toBeUndefined();
    });

    it('should handle errors and track failed generation', async () => {
      // Arrange
      const error = new Error('Generation failed');
      pmViewGenerator.generatePmView.mockRejectedValue(error);

      // Act & Assert
      await expect(service.generateAllViews(mockViewGenerationContext)).rejects.toThrow(
        'Generation failed',
      );

      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'multi_view_generation',
        expect.any(Number),
        false,
      );
    });

    it('should use default options when none provided', async () => {
      // Arrange
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);
      frontendViewGenerator.generateFrontendView.mockResolvedValue(mockFrontendView);
      backendViewGenerator.generateBackendView.mockResolvedValue(mockBackendView);

      const contextWithoutOptions: ViewGenerationContext = {
        ...mockViewGenerationContext,
        options: undefined,
      };

      // Act
      await service.generateAllViews(contextWithoutOptions);

      // Assert
      expect(pmViewGenerator.generatePmView).toHaveBeenCalledWith(
        contextWithoutOptions,
        expect.objectContaining({
          detailLevel: undefined,
          includeExamples: undefined,
        }),
      );
    });
  });

  describe('generateSingleView', () => {
    it('should generate PM view correctly', async () => {
      // Arrange
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);

      // Act
      const result = await service.generateSingleView('pm', mockViewGenerationContext);

      // Assert
      expect(pmViewGenerator.generatePmView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        undefined,
      );
      expect(result).toEqual(mockPmView);
      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'pm_view_generation',
        expect.any(Number),
        true,
      );
    });

    it('should generate frontend view correctly', async () => {
      // Arrange
      frontendViewGenerator.generateFrontendView.mockResolvedValue(mockFrontendView);

      // Act
      const result = await service.generateSingleView('frontend', mockViewGenerationContext);

      // Assert
      expect(frontendViewGenerator.generateFrontendView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        undefined,
      );
      expect(result).toEqual(mockFrontendView);
      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'frontend_view_generation',
        expect.any(Number),
        true,
      );
    });

    it('should generate backend view correctly', async () => {
      // Arrange
      backendViewGenerator.generateBackendView.mockResolvedValue(mockBackendView);

      // Act
      const result = await service.generateSingleView('backend', mockViewGenerationContext);

      // Assert
      expect(backendViewGenerator.generateBackendView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        undefined,
      );
      expect(result).toEqual(mockBackendView);
      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'backend_view_generation',
        expect.any(Number),
        true,
      );
    });

    it('should pass options to generators', async () => {
      // Arrange
      const options: ViewGeneratorOptions = {
        temperature: 0.5,
        maxTokens: 2000,
        detailLevel: 'comprehensive',
      };
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);

      // Act
      await service.generateSingleView('pm', mockViewGenerationContext, options);

      // Assert
      expect(pmViewGenerator.generatePmView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        options,
      );
    });

    it('should handle single view generation errors', async () => {
      // Arrange
      const error = new Error('PM view generation failed');
      pmViewGenerator.generatePmView.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.generateSingleView('pm', mockViewGenerationContext),
      ).rejects.toThrow('PM view generation failed');

      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'pm_view_generation',
        expect.any(Number),
        false,
      );
    });
  });

  describe('regenerateViewSection', () => {
    it('should regenerate view section with comprehensive detail', async () => {
      // Arrange
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);

      // Act
      const result = await service.regenerateViewSection(
        'pm',
        'userStories',
        mockViewGenerationContext,
        mockPmView,
        ['Add more detail to user stories'],
      );

      // Assert
      expect(pmViewGenerator.generatePmView).toHaveBeenCalledWith(
        mockViewGenerationContext,
        expect.objectContaining({
          detailLevel: 'comprehensive',
        }),
      );
      expect(result).toEqual(mockPmView);
    });
  });

  describe('validateViewConsistency', () => {
    it('should identify consistency issues', () => {
      // Arrange
      const inconsistentViews: GeneratedViews = {
        pmView: {
          ...mockPmView,
          userStories: [
            {
              id: 'US001',
              title: 'Special Feature',
              description: 'A feature not in frontend',
              acceptanceCriteria: ['Must work'],
              priority: 'High',
            },
          ],
        },
        frontendView: mockFrontendView,
        backendView: mockBackendView,
      };

      // Act
      const result = service.validateViewConsistency(inconsistentViews);

      // Assert
      expect(result.isConsistent).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('Not all user stories have corresponding'),
      );
    });

    it('should validate consistent views', () => {
      // Arrange
      const consistentViews: GeneratedViews = {
        pmView: {
          ...mockPmView,
          userStories: [
            {
              id: 'US001',
              title: 'Product Grid',
              description: 'Display products in grid',
              acceptanceCriteria: ['Grid displays'],
              priority: 'High',
            },
          ],
        },
        frontendView: mockFrontendView,
        backendView: mockBackendView,
      };

      // Act
      const result = service.validateViewConsistency(consistentViews);

      // Assert
      expect(result.isConsistent).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('private methods', () => {
    it('should estimate tokens correctly', () => {
      // This tests the private estimateTokens method indirectly
      // through generateAllViews which calls it
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);
      frontendViewGenerator.generateFrontendView.mockResolvedValue(mockFrontendView);
      backendViewGenerator.generateBackendView.mockResolvedValue(mockBackendView);

      return service.generateAllViews(mockViewGenerationContext).then(result => {
        expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      });
    });

    it('should calculate confidence score', () => {
      // This tests the private calculateConfidence method indirectly
      pmViewGenerator.generatePmView.mockResolvedValue(mockPmView);
      frontendViewGenerator.generateFrontendView.mockResolvedValue(mockFrontendView);
      backendViewGenerator.generateBackendView.mockResolvedValue(mockBackendView);

      return service.generateAllViews(mockViewGenerationContext).then(result => {
        expect(result.metadata.confidence).toBeGreaterThan(0);
        expect(result.metadata.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});