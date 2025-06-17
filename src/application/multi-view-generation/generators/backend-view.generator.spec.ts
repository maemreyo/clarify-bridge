// Test backend view generation functionality

import { Test, TestingModule } from '@nestjs/testing';
import { BackendViewGenerator } from './backend-view.generator';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import {
  ViewGenerationContext,
  ViewGeneratorOptions,
} from '../interfaces/view-generation.interface';
import { ProcessedContext } from '@application/context-ingestion';

describe('BackendViewGenerator', () => {
  let generator: BackendViewGenerator;
  let llmService: jest.Mocked<LlmCoreService>;

  // Mock data
  const mockProcessedContext: ProcessedContext = {
    summary: 'E-learning platform with course management and student tracking',
    keyRequirements: [
      'User authentication and role management',
      'Course creation and management',
      'Student enrollment and progress tracking',
      'Video streaming and content delivery',
      'Assessment and grading system',
    ],
    technicalDetails: {
      stack: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'AWS S3'],
      architecture: 'Microservices with API Gateway',
      integrations: ['Payment Gateway', 'Video CDN', 'Email Service'],
      constraints: ['GDPR compliance', 'Handle 10k concurrent users', 'Sub-second API response'],
      uiComponents: ['Course Catalog', 'Video Player', 'Progress Dashboard'],
    },
    userStories: [
      'As an instructor, I want to create and manage courses',
      'As a student, I want to enroll in courses and track progress',
      'As an admin, I want to manage users and system settings',
    ],
    businessRules: [
      'Students can only access enrolled courses',
      'Instructors can only edit their own courses',
      'Payment required for premium courses',
      'Video content expires after course completion',
    ],
    metadata: {
      wordCount: 800,
      hasImages: false,
      complexity: 'complex',
      confidence: 0.9,
    },
  };

  const mockViewGenerationContext: ViewGenerationContext = {
    processed: mockProcessedContext,
    originalRequirements: 'Build a comprehensive e-learning platform for online education',
    options: {
      detailLevel: 'detailed',
      includeExamples: true,
      generateDiagrams: false,
    },
  };

  const mockLlmResponse = {
    content: JSON.stringify({
      apis: [
        {
          endpoint: '/api/courses',
          method: 'GET',
          description: 'Retrieve all available courses',
          parameters: [
            { name: 'category', type: 'string', required: false },
            { name: 'level', type: 'string', required: false },
            { name: 'page', type: 'number', required: false },
          ],
          responses: {
            200: {
              description: 'List of courses retrieved successfully',
              schema: 'CourseList',
              example: { courses: [], total: 0, page: 1 },
            },
            400: { description: 'Invalid query parameters' },
            500: { description: 'Internal server error' },
          },
          authentication: 'Bearer token',
        },
        {
          endpoint: '/api/courses/{id}/enroll',
          method: 'POST',
          description: 'Enroll student in a course',
          parameters: [
            { name: 'id', type: 'string', in: 'path', required: true },
          ],
          requestBody: {
            type: 'object',
            properties: {
              paymentToken: { type: 'string', required: true },
            },
          },
          responses: {
            201: { description: 'Enrollment successful', schema: 'Enrollment' },
            402: { description: 'Payment required' },
            404: { description: 'Course not found' },
          },
          authentication: 'Bearer token',
        },
      ],
      dataModels: [
        {
          name: 'User',
          description: 'User account information',
          fields: [
            { name: 'id', type: 'UUID', required: true, primary: true },
            { name: 'email', type: 'string', required: true, unique: true },
            { name: 'password', type: 'string', required: true, hashed: true },
            { name: 'role', type: 'enum', values: ['student', 'instructor', 'admin'] },
            { name: 'profile', type: 'object', relation: 'UserProfile' },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
          ],
          indexes: ['email', 'role'],
          relations: [
            { type: 'hasOne', model: 'UserProfile' },
            { type: 'hasMany', model: 'Enrollment' },
          ],
        },
        {
          name: 'Course',
          description: 'Course information and content',
          fields: [
            { name: 'id', type: 'UUID', required: true, primary: true },
            { name: 'title', type: 'string', required: true },
            { name: 'description', type: 'text', required: true },
            { name: 'price', type: 'decimal', precision: 10, scale: 2 },
            { name: 'instructorId', type: 'UUID', required: true, foreign: 'User.id' },
            { name: 'category', type: 'string', required: true },
            { name: 'level', type: 'enum', values: ['beginner', 'intermediate', 'advanced'] },
            { name: 'duration', type: 'integer', description: 'Duration in minutes' },
            { name: 'isPublished', type: 'boolean', default: false },
          ],
          indexes: ['instructorId', 'category', 'level', 'isPublished'],
          relations: [
            { type: 'belongsTo', model: 'User', as: 'instructor' },
            { type: 'hasMany', model: 'Lesson' },
            { type: 'hasMany', model: 'Enrollment' },
          ],
        },
      ],
      services: [
        {
          name: 'AuthenticationService',
          description: 'Handles user authentication and authorization',
          methods: [
            {
              name: 'login',
              parameters: ['email: string', 'password: string'],
              returns: 'Promise<AuthResult>',
              description: 'Authenticate user credentials',
            },
            {
              name: 'validateToken',
              parameters: ['token: string'],
              returns: 'Promise<User>',
              description: 'Validate JWT token and return user',
            },
            {
              name: 'refreshToken',
              parameters: ['refreshToken: string'],
              returns: 'Promise<TokenPair>',
              description: 'Generate new access token',
            },
          ],
          dependencies: ['UserRepository', 'JwtService', 'BcryptService'],
        },
        {
          name: 'CourseService',
          description: 'Handles course creation, management, and enrollment',
          methods: [
            {
              name: 'createCourse',
              parameters: ['courseData: CreateCourseDto', 'instructorId: string'],
              returns: 'Promise<Course>',
              description: 'Create new course',
            },
            {
              name: 'enrollStudent',
              parameters: ['courseId: string', 'studentId: string', 'paymentToken?: string'],
              returns: 'Promise<Enrollment>',
              description: 'Enroll student in course',
            },
          ],
          dependencies: ['CourseRepository', 'EnrollmentRepository', 'PaymentService'],
        },
      ],
      infrastructure: {
        database: {
          type: 'PostgreSQL',
          version: '14+',
          connectionPooling: true,
          replication: 'master-slave',
          backup: 'daily automated backups',
        },
        cache: {
          type: 'Redis',
          useCase: 'Session storage, API caching, rate limiting',
          clustering: true,
        },
        queue: {
          type: 'Bull Queue with Redis',
          queues: ['email-notifications', 'video-processing', 'analytics'],
        },
        storage: {
          type: 'AWS S3',
          buckets: ['course-videos', 'user-uploads', 'static-assets'],
          cdn: 'CloudFront integration',
        },
        monitoring: {
          logging: 'Winston with structured logging',
          metrics: 'Prometheus with Grafana',
          errorTracking: 'Sentry integration',
        },
      },
      security: {
        authentication: 'JWT with refresh tokens',
        authorization: 'Role-based access control (RBAC)',
        dataProtection: 'Encryption at rest and in transit',
        rateLimit: '100 requests per minute per user',
        cors: 'Configurable CORS for frontend domains',
        validation: 'Input validation with class-validator',
      },
    }),
    usage: {
      promptTokens: 2000,
      completionTokens: 3000,
      totalTokens: 5000,
    },
    provider: 'openai',
  };

  const mockGeneratorOptions: ViewGeneratorOptions = {
    temperature: 0.7,
    maxTokens: 3500,
    includeExamples: true,
    detailLevel: 'detailed',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackendViewGenerator,
        {
          provide: LlmCoreService,
          useValue: {
            generateFromTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    generator = module.get<BackendViewGenerator>(BackendViewGenerator);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('generateBackendView', () => {
    it('should generate backend view successfully with default options', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generateBackendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Backend Developer'),
          user: expect.stringContaining(mockViewGenerationContext.originalRequirements),
        }),
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 3500,
        }),
      );

      expect(result).toHaveProperty('apis');
      expect(result).toHaveProperty('dataModels');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('infrastructure');
      expect(result).toHaveProperty('security');
      expect(result.apis).toHaveLength(2);
      expect(result.dataModels).toHaveLength(2);
      expect(result.services).toHaveLength(2);
    });

    it('should generate backend view with custom options', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generateBackendView(
        mockViewGenerationContext,
        mockGeneratorOptions,
      );

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('detailed'),
          user: expect.any(String),
        }),
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 3500,
        }),
      );

      expect(result).toEqual(JSON.parse(mockLlmResponse.content));
    });

    it('should include technology stack in prompt', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext, mockGeneratorOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Node.js, Express, PostgreSQL, Redis, AWS S3'),
        }),
        expect.any(Object),
      );
    });

    it('should handle missing technology stack', async () => {
      // Arrange
      const contextWithoutStack: ViewGenerationContext = {
        ...mockViewGenerationContext,
        processed: {
          ...mockProcessedContext,
          technicalDetails: {
            ...mockProcessedContext.technicalDetails,
            stack: undefined,
          },
        },
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(contextWithoutStack);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('modern backend technologies'),
        }),
        expect.any(Object),
      );
    });

    it('should handle comprehensive detail level', async () => {
      // Arrange
      const comprehensiveOptions: ViewGeneratorOptions = {
        ...mockGeneratorOptions,
        detailLevel: 'comprehensive',
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext, comprehensiveOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('detailed request/response schemas'),
        }),
        expect.any(Object),
      );
    });

    it('should handle basic detail level', async () => {
      // Arrange
      const basicOptions: ViewGeneratorOptions = {
        ...mockGeneratorOptions,
        detailLevel: 'basic',
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext, basicOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.not.stringContaining('detailed request/response schemas'),
        }),
        expect.any(Object),
      );
    });

    it('should include code examples when requested', async () => {
      // Arrange
      const optionsWithExamples: ViewGeneratorOptions = {
        ...mockGeneratorOptions,
        includeExamples: true,
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext, optionsWithExamples);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('code examples'),
        }),
        expect.any(Object),
      );
    });

    it('should include business rules in prompt when available', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringMatching(/Business Rules:/),
        }),
        expect.any(Object),
      );
    });

    it('should include architecture constraints in prompt', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('GDPR compliance'),
        }),
        expect.any(Object),
      );
    });

    it('should include integrations in prompt when available', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('Payment Gateway, Video CDN, Email Service'),
        }),
        expect.any(Object),
      );
    });

    it('should include team knowledge when available', async () => {
      // Arrange
      const contextWithEnhancement: ViewGenerationContext = {
        ...mockViewGenerationContext,
        enhancement: {
          relatedSpecifications: [
            {
              id: 'spec-1',
              title: 'Previous API Design',
              relevance: 0.9,
              insights: ['Use OpenAPI 3.0 specification', 'Implement rate limiting'],
            },
          ],
          teamKnowledge: [
            {
              title: 'Architecture Patterns',
              content: 'Team prefers clean architecture with dependency injection',
              relevance: 0.85,
            },
          ],
          suggestedTechnologies: ['NestJS', 'TypeORM'],
          commonPatterns: ['Repository pattern', 'Service layer architecture'],
        },
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(contextWithEnhancement, mockGeneratorOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('Team prefers clean architecture'),
        }),
        expect.any(Object),
      );
    });

    it('should handle LLM service errors', async () => {
      // Arrange
      const error = new Error('Backend generation failed');
      llmService.generateFromTemplate.mockRejectedValue(error);

      // Act & Assert
      await expect(generator.generateBackendView(mockViewGenerationContext)).rejects.toThrow(
        'Backend generation failed',
      );
    });

    it('should handle malformed JSON response', async () => {
      // Arrange
      const malformedResponse = {
        ...mockLlmResponse,
        content: '{"apis": [incomplete json',
      };
      llmService.generateFromTemplate.mockResolvedValue(malformedResponse);

      // Act & Assert
      await expect(generator.generateBackendView(mockViewGenerationContext)).rejects.toThrow();
    });

    it('should validate required response structure', async () => {
      // Arrange
      const validResponse = {
        ...mockLlmResponse,
        content: JSON.stringify({
          apis: [],
          dataModels: [],
          services: [],
          infrastructure: { database: 'PostgreSQL' },
          security: { authentication: 'JWT' },
        }),
      };
      llmService.generateFromTemplate.mockResolvedValue(validResponse);

      // Act
      const result = await generator.generateBackendView(mockViewGenerationContext);

      // Assert
      expect(result).toHaveProperty('apis');
      expect(result).toHaveProperty('dataModels');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('infrastructure');
      expect(result).toHaveProperty('security');
    });

    it('should include microservices architecture in prompt when specified', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('Microservices with API Gateway'),
        }),
        expect.any(Object),
      );
    });

    it('should build proper prompt structure', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext, mockGeneratorOptions);

      // Assert
      const callArgs = llmService.generateFromTemplate.mock.calls[0];
      const prompt = callArgs[0] as PromptTemplate;

      expect(prompt.system).toContain('Backend Developer');
      expect(prompt.system).toContain('RESTful APIs');
      expect(prompt.system).toContain('scalable');
      expect(prompt.user).toContain(mockViewGenerationContext.originalRequirements);
      expect(prompt.user).toContain(mockViewGenerationContext.processed.summary);
    });

    it('should handle empty technical details gracefully', async () => {
      // Arrange
      const contextWithEmptyDetails: ViewGenerationContext = {
        ...mockViewGenerationContext,
        processed: {
          ...mockProcessedContext,
          technicalDetails: {
            stack: [],
            architecture: undefined,
            integrations: [],
            constraints: [],
            uiComponents: [],
          },
        },
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generateBackendView(contextWithEmptyDetails);

      // Assert
      expect(result).toHaveProperty('apis');
      expect(llmService.generateFromTemplate).toHaveBeenCalled();
    });

    it('should pass correct parameters to LLM service', async () => {
      // Arrange
      const customOptions: ViewGeneratorOptions = {
        temperature: 0.5,
        maxTokens: 4000,
        detailLevel: 'comprehensive',
        includeExamples: false,
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateBackendView(mockViewGenerationContext, customOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          temperature: 0.5,
          maxTokens: 4000,
        }),
      );
    });

    it('should handle empty business rules array', async () => {
      // Arrange
      const contextWithoutRules: ViewGenerationContext = {
        ...mockViewGenerationContext,
        processed: {
          ...mockProcessedContext,
          businessRules: [],
        },
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generateBackendView(contextWithoutRules);

      // Assert
      expect(result).toHaveProperty('apis');
      expect(llmService.generateFromTemplate).toHaveBeenCalled();
    });
  });
});