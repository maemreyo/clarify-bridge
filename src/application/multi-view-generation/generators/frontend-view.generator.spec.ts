// Test frontend view generation functionality

import { Test, TestingModule } from '@nestjs/testing';
import { FrontendViewGenerator } from './frontend-view.generator';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import {
  ViewGenerationContext,
  ViewGeneratorOptions,
} from '../interfaces/view-generation.interface';
import { ProcessedContext } from '@application/context-ingestion';

describe('FrontendViewGenerator', () => {
  let generator: FrontendViewGenerator;
  let llmService: jest.Mocked<LlmCoreService>;

  // Mock data
  const mockProcessedContext: ProcessedContext = {
    summary: 'Social media dashboard for content creators',
    keyRequirements: [
      'User profile management',
      'Content posting and scheduling',
      'Analytics dashboard',
      'Follower engagement tracking',
    ],
    technicalDetails: {
      stack: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js'],
      architecture: 'JAMstack with SSR',
      integrations: ['Instagram API', 'Twitter API', 'Analytics'],
      constraints: ['Mobile-first design', 'Accessibility compliance'],
      uiComponents: ['Dashboard', 'Post Editor', 'Analytics Charts', 'Profile Settings'],
    },
    userStories: [
      'As a content creator, I want to schedule posts across platforms',
      'As a user, I want to view my engagement analytics',
      'As a creator, I want to manage my profile information',
    ],
    businessRules: [
      'Posts can be scheduled up to 30 days in advance',
      'Analytics data is updated every hour',
      'Free accounts limited to 10 posts per month',
    ],
    metadata: {
      wordCount: 600,
      hasImages: true,
      complexity: 'moderate',
      confidence: 0.85,
    },
  };

  const mockViewGenerationContext: ViewGenerationContext = {
    processed: mockProcessedContext,
    originalRequirements: 'Build a social media management dashboard for content creators',
    options: {
      detailLevel: 'detailed',
      includeExamples: true,
      generateDiagrams: false,
    },
  };

  const mockLlmResponse = {
    content: JSON.stringify({
      components: [
        {
          name: 'Dashboard',
          type: 'page',
          description: 'Main dashboard showing overview of all social media accounts',
          props: ['user', 'accounts', 'recentPosts'],
          state: ['selectedAccount', 'timeRange'],
          children: ['AccountCard', 'PostPreview', 'AnalyticsWidget'],
        },
        {
          name: 'PostEditor',
          type: 'component',
          description: 'Rich text editor for creating and scheduling posts',
          props: ['onSave', 'initialContent', 'platforms'],
          state: ['content', 'scheduledTime', 'selectedPlatforms'],
          children: ['TextEditor', 'MediaUpload', 'ScheduleSelector'],
        },
        {
          name: 'AnalyticsChart',
          type: 'component',
          description: 'Interactive chart showing engagement metrics',
          props: ['data', 'type', 'timeRange'],
          state: ['chartType', 'filters'],
          children: ['ChartContainer', 'FilterControls'],
        },
      ],
      pages: [
        {
          name: 'DashboardPage',
          path: '/dashboard',
          description: 'Main application dashboard',
          components: ['Header', 'Sidebar', 'Dashboard', 'Footer'],
          layout: 'DashboardLayout',
          authentication: true,
        },
        {
          name: 'ProfilePage',
          path: '/profile',
          description: 'User profile management page',
          components: ['Header', 'ProfileSettings', 'AccountConnections'],
          layout: 'DefaultLayout',
          authentication: true,
        },
        {
          name: 'AnalyticsPage',
          path: '/analytics',
          description: 'Detailed analytics and reporting',
          components: ['Header', 'AnalyticsOverview', 'DetailedCharts'],
          layout: 'FullWidthLayout',
          authentication: true,
        },
      ],
      stateManagement: {
        type: 'Redux Toolkit',
        slices: [
          {
            name: 'user',
            initialState: { profile: null, accounts: [], preferences: {} },
            reducers: ['setProfile', 'updatePreferences', 'addAccount'],
          },
          {
            name: 'posts',
            initialState: { drafts: [], scheduled: [], published: [] },
            reducers: ['addDraft', 'schedulePost', 'publishPost'],
          },
          {
            name: 'analytics',
            initialState: { data: {}, loading: false, error: null },
            reducers: ['setAnalyticsData', 'setLoading', 'setError'],
          },
        ],
        middleware: ['thunk', 'logger'],
      },
      routing: [
        { path: '/', component: 'LandingPage', public: true },
        { path: '/login', component: 'LoginPage', public: true },
        { path: '/dashboard', component: 'DashboardPage', protected: true },
        { path: '/profile', component: 'ProfilePage', protected: true },
        { path: '/analytics', component: 'AnalyticsPage', protected: true },
        { path: '/post/new', component: 'PostEditorPage', protected: true },
      ],
      styling: {
        framework: 'Tailwind CSS',
        theme: {
          colors: {
            primary: '#3B82F6',
            secondary: '#10B981',
            accent: '#F59E0B',
          },
          fonts: {
            sans: ['Inter', 'system-ui'],
            mono: ['Fira Code', 'monospace'],
          },
        },
        responsiveBreakpoints: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
        },
      },
      dataFlow: {
        type: 'Unidirectional',
        patterns: ['Redux for global state', 'React Query for server state'],
        apiIntegration: {
          method: 'REST API',
          baseUrl: '/api/v1',
          authentication: 'JWT Bearer tokens',
        },
      },
    }),
    usage: {
      promptTokens: 1800,
      completionTokens: 2500,
      totalTokens: 4300,
    },
    provider: 'openai',
  };

  const mockGeneratorOptions: ViewGeneratorOptions = {
    temperature: 0.6,
    maxTokens: 4000,
    includeExamples: true,
    detailLevel: 'detailed',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrontendViewGenerator,
        {
          provide: LlmCoreService,
          useValue: {
            generateFromTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    generator = module.get<FrontendViewGenerator>(FrontendViewGenerator);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('generateFrontendView', () => {
    it('should generate frontend view successfully with default options', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generateFrontendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Frontend Developer'),
          user: expect.stringContaining(mockViewGenerationContext.originalRequirements),
        }),
        expect.objectContaining({
          temperature: 0.6,
          maxTokens: 4000,
        }),
      );

      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('pages');
      expect(result).toHaveProperty('stateManagement');
      expect(result).toHaveProperty('routing');
      expect(result).toHaveProperty('styling');
      expect(result.components).toHaveLength(3);
      expect(result.pages).toHaveLength(3);
    });

    it('should generate frontend view with custom options', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generateFrontendView(
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
          temperature: 0.6,
          maxTokens: 4000,
        }),
      );

      expect(result).toEqual(JSON.parse(mockLlmResponse.content));
    });

    it('should include technology stack in prompt', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateFrontendView(mockViewGenerationContext, mockGeneratorOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('React, TypeScript, Tailwind CSS, Next.js'),
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
      await generator.generateFrontendView(contextWithoutStack);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('modern frontend framework'),
        }),
        expect.any(Object),
      );
    });

    it('should include UI components in prompt when available', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateFrontendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringMatching(/UI Components:/),
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
      await generator.generateFrontendView(mockViewGenerationContext, comprehensiveOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('comprehensive'),
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
      await generator.generateFrontendView(mockViewGenerationContext, basicOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('high-level'),
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
      await generator.generateFrontendView(mockViewGenerationContext, optionsWithExamples);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('examples'),
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
              title: 'Previous Dashboard Project',
              relevance: 0.9,
              insights: ['Use card-based layout', 'Implement dark mode'],
            },
          ],
          teamKnowledge: [
            {
              title: 'Design System',
              content: 'Team uses Material-UI components',
              relevance: 0.8,
            },
          ],
          suggestedTechnologies: ['React', 'Material-UI'],
          commonPatterns: ['Component composition', 'Hooks pattern'],
        },
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateFrontendView(contextWithEnhancement, mockGeneratorOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('Team uses Material-UI components'),
        }),
        expect.any(Object),
      );
    });

    it('should handle architecture constraints', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateFrontendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('Mobile-first design'),
        }),
        expect.any(Object),
      );
    });

    it('should handle LLM service errors', async () => {
      // Arrange
      const error = new Error('Frontend generation failed');
      llmService.generateFromTemplate.mockRejectedValue(error);

      // Act & Assert
      await expect(generator.generateFrontendView(mockViewGenerationContext)).rejects.toThrow(
        'Frontend generation failed',
      );
    });

    it('should handle malformed JSON response', async () => {
      // Arrange
      const malformedResponse = {
        ...mockLlmResponse,
        content: 'invalid json {incomplete',
      };
      llmService.generateFromTemplate.mockResolvedValue(malformedResponse);

      // Act & Assert
      await expect(generator.generateFrontendView(mockViewGenerationContext)).rejects.toThrow();
    });

    it('should validate required response structure', async () => {
      // Arrange
      const validResponse = {
        ...mockLlmResponse,
        content: JSON.stringify({
          components: [],
          pages: [],
          stateManagement: { type: 'Redux' },
          routing: [],
          styling: { framework: 'CSS' },
        }),
      };
      llmService.generateFromTemplate.mockResolvedValue(validResponse);

      // Act
      const result = await generator.generateFrontendView(mockViewGenerationContext);

      // Assert
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('pages');
      expect(result).toHaveProperty('stateManagement');
      expect(result).toHaveProperty('routing');
      expect(result).toHaveProperty('styling');
    });

    it('should include integrations in prompt when available', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateFrontendView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('Instagram API, Twitter API, Analytics'),
        }),
        expect.any(Object),
      );
    });

    it('should build proper prompt structure for responsive design', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateFrontendView(mockViewGenerationContext, mockGeneratorOptions);

      // Assert
      const callArgs = llmService.generateFromTemplate.mock.calls[0];
      const prompt = callArgs[0] as PromptTemplate;

      expect(prompt.system).toContain('Frontend Developer');
      expect(prompt.system).toContain('responsive');
      expect(prompt.user).toContain(mockViewGenerationContext.originalRequirements);
      expect(prompt.user).toContain('Mobile-first design');
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
      const result = await generator.generateFrontendView(contextWithEmptyDetails);

      // Assert
      expect(result).toHaveProperty('components');
      expect(llmService.generateFromTemplate).toHaveBeenCalled();
    });

    it('should pass correct maxTokens for different detail levels', async () => {
      // Arrange
      const comprehensiveOptions: ViewGeneratorOptions = {
        detailLevel: 'comprehensive',
        maxTokens: 5000,
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generateFrontendView(mockViewGenerationContext, comprehensiveOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          maxTokens: 5000,
        }),
      );
    });
  });
});
