// Test PM view generation functionality

import { Test, TestingModule } from '@nestjs/testing';
import { PmViewGenerator } from './pm-view.generator';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import {
  ViewGenerationContext,
  ViewGeneratorOptions,
} from '../interfaces/view-generation.interface';
import { ProcessedContext } from '@application/context-ingestion';

describe('PmViewGenerator', () => {
  let generator: PmViewGenerator;
  let llmService: jest.Mocked<LlmCoreService>;

  // Mock data
  const mockProcessedContext: ProcessedContext = {
    summary: 'Task management application with team collaboration features',
    keyRequirements: [
      'User authentication and authorization',
      'Task creation and assignment',
      'Team collaboration features',
      'Real-time notifications',
      'Dashboard with analytics',
    ],
    technicalDetails: {
      stack: ['React', 'Node.js', 'PostgreSQL', 'Socket.io'],
      architecture: 'Monolithic with microservices potential',
      integrations: ['Slack', 'Google Calendar', 'Email'],
      constraints: ['Must be mobile responsive', 'GDPR compliant'],
      uiComponents: ['Dashboard', 'Task List', 'User Profile', 'Settings'],
    },
    userStories: [
      'As a team lead, I want to assign tasks to team members',
      'As a user, I want to track my task progress',
      'As a manager, I want to view team performance analytics',
    ],
    businessRules: [
      'Only team leads can assign tasks',
      'Tasks must have due dates',
      'Users can only edit their own tasks',
    ],
    metadata: {
      wordCount: 750,
      hasImages: false,
      complexity: 'moderate',
      confidence: 0.9,
    },
  };

  const mockViewGenerationContext: ViewGenerationContext = {
    processed: mockProcessedContext,
    originalRequirements: 'Build a comprehensive task management platform for teams',
    options: {
      detailLevel: 'detailed',
      includeExamples: true,
      generateDiagrams: false,
    },
  };

  const mockLlmResponse = {
    content: JSON.stringify({
      overview: {
        title: 'Team Task Management Platform',
        description: 'A comprehensive task management solution for teams',
        objectives: [
          'Improve team productivity',
          'Enable better task tracking',
          'Facilitate team collaboration',
        ],
        scope: {
          included: ['Task management', 'Team collaboration', 'Analytics'],
          excluded: ['Time tracking', 'Invoice generation'],
        },
      },
      userStories: [
        {
          id: 'US001',
          title: 'Assign Tasks',
          description: 'As a team lead, I want to assign tasks to team members so that work is distributed effectively',
          acceptanceCriteria: [
            'Team lead can select team member from dropdown',
            'Task assignment sends notification to assignee',
            'Assigned tasks appear in assignee dashboard',
          ],
          priority: 'High',
          estimatedEffort: '3 story points',
          dependencies: ['User management system'],
        },
        {
          id: 'US002',
          title: 'Track Task Progress',
          description: 'As a user, I want to update my task status so that the team knows my progress',
          acceptanceCriteria: [
            'User can change task status (ToDo, In Progress, Done)',
            'Status changes are logged with timestamp',
            'Team members are notified of status updates',
          ],
          priority: 'High',
          estimatedEffort: '2 story points',
          dependencies: [],
        },
      ],
      features: [
        {
          id: 'F001',
          name: 'Task Management',
          description: 'Core task creation, assignment, and tracking functionality',
          requirements: [
            'Create new tasks with title, description, due date',
            'Assign tasks to team members',
            'Update task status and progress',
            'Add comments to tasks',
          ],
          acceptanceCriteria: [
            'Tasks can be created with all required fields',
            'Task assignments work correctly',
            'Status updates are reflected in real-time',
          ],
        },
        {
          id: 'F002',
          name: 'Team Collaboration',
          description: 'Features that enable team members to work together effectively',
          requirements: [
            'Real-time task updates',
            'Comment system on tasks',
            'Team member notifications',
            'Shared team dashboard',
          ],
          acceptanceCriteria: [
            'All team members see updates immediately',
            'Notifications are delivered reliably',
            'Dashboard shows accurate team metrics',
          ],
        },
      ],
      businessRules: mockProcessedContext.businessRules,
      riskAssessment: {
        high: ['Integration complexity with external systems'],
        medium: ['User adoption challenges', 'Performance with large teams'],
        low: ['UI/UX design iterations'],
      },
      timeline: {
        phases: [
          {
            name: 'Phase 1: Core Features',
            duration: '6 weeks',
            deliverables: ['User authentication', 'Basic task management'],
          },
          {
            name: 'Phase 2: Team Features',
            duration: '4 weeks',
            deliverables: ['Team collaboration', 'Notifications'],
          },
        ],
        totalDuration: '10 weeks',
      },
    }),
    usage: {
      promptTokens: 1500,
      completionTokens: 2000,
      totalTokens: 3500,
    },
    provider: 'openai',
  };

  const mockGeneratorOptions: ViewGeneratorOptions = {
    temperature: 0.7,
    maxTokens: 3000,
    includeExamples: true,
    detailLevel: 'detailed',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PmViewGenerator,
        {
          provide: LlmCoreService,
          useValue: {
            generateFromTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    generator = module.get<PmViewGenerator>(PmViewGenerator);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('generatePmView', () => {
    it('should generate PM view successfully with default options', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generatePmView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Product Manager'),
          user: expect.stringContaining(mockViewGenerationContext.originalRequirements),
        }),
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 3500,
        }),
      );

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('userStories');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('businessRules');
      expect(result).toHaveProperty('timeline');
      expect(result.userStories).toHaveLength(2);
      expect(result.features).toHaveLength(2);
    });

    it('should generate PM view with custom options', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await generator.generatePmView(
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
          maxTokens: 3000,
        }),
      );

      expect(result).toEqual(JSON.parse(mockLlmResponse.content));
    });

    it('should include team knowledge in prompt when available', async () => {
      // Arrange
      const contextWithEnhancement: ViewGenerationContext = {
        ...mockViewGenerationContext,
        enhancement: {
          relatedSpecifications: [
            {
              id: 'spec-1',
              title: 'Previous Task Management System',
              relevance: 0.8,
              insights: ['Use card-based layout', 'Include search functionality'],
            },
          ],
          teamKnowledge: [
            {
              title: 'Team Preferences',
              content: 'Team prefers agile methodology',
              relevance: 0.9,
            },
          ],
          suggestedTechnologies: ['React', 'Node.js'],
          commonPatterns: ['RESTful APIs', 'Component-based architecture'],
        },
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generatePmView(contextWithEnhancement, mockGeneratorOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringContaining('Team prefers agile methodology'),
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
      await generator.generatePmView(mockViewGenerationContext, comprehensiveOptions);

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
      await generator.generatePmView(mockViewGenerationContext, basicOptions);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('concise'),
        }),
        expect.any(Object),
      );
    });

    it('should include examples when requested', async () => {
      // Arrange
      const optionsWithExamples: ViewGeneratorOptions = {
        ...mockGeneratorOptions,
        includeExamples: true,
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generatePmView(mockViewGenerationContext, optionsWithExamples);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('examples'),
        }),
        expect.any(Object),
      );
    });

    it('should handle missing technical stack gracefully', async () => {
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
      await generator.generatePmView(contextWithoutStack);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('technology-agnostic'),
        }),
        expect.any(Object),
      );
    });

    it('should handle LLM service errors', async () => {
      // Arrange
      const error = new Error('LLM service unavailable');
      llmService.generateFromTemplate.mockRejectedValue(error);

      // Act & Assert
      await expect(generator.generatePmView(mockViewGenerationContext)).rejects.toThrow(
        'LLM service unavailable',
      );
    });

    it('should handle malformed JSON response', async () => {
      // Arrange
      const malformedResponse = {
        ...mockLlmResponse,
        content: 'invalid json content',
      };
      llmService.generateFromTemplate.mockResolvedValue(malformedResponse);

      // Act & Assert
      await expect(generator.generatePmView(mockViewGenerationContext)).rejects.toThrow();
    });

    it('should include user stories in prompt when available', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generatePmView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringMatching(/User Stories:/),
        }),
        expect.any(Object),
      );
    });

    it('should include business rules in prompt when available', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generatePmView(mockViewGenerationContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.stringMatching(/Business Rules:/),
        }),
        expect.any(Object),
      );
    });

    it('should build proper prompt structure', async () => {
      // Arrange
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      await generator.generatePmView(mockViewGenerationContext, mockGeneratorOptions);

      // Assert
      const callArgs = llmService.generateFromTemplate.mock.calls[0];
      const prompt = callArgs[0] as PromptTemplate;

      expect(prompt.system).toContain('Product Manager');
      expect(prompt.system).toContain('detailed');
      expect(prompt.user).toContain(mockViewGenerationContext.originalRequirements);
      expect(prompt.user).toContain(mockViewGenerationContext.processed.summary);
    });

    it('should validate response structure', async () => {
      // Arrange
      const validResponse = {
        ...mockLlmResponse,
        content: JSON.stringify({
          overview: { title: 'Test' },
          userStories: [],
          features: [],
          businessRules: [],
        }),
      };
      llmService.generateFromTemplate.mockResolvedValue(validResponse);

      // Act
      const result = await generator.generatePmView(mockViewGenerationContext);

      // Assert
      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('userStories');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('businessRules');
    });
  });
});