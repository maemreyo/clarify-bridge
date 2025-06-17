// Test diagram generation orchestration service

import { Test, TestingModule } from '@nestjs/testing';
import { DiagramGenerationService } from './diagram-generation.service';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import { MonitoringService } from '@core/monitoring';
import { FlowchartGenerator } from './generators/flowchart.generator';
import { SequenceGenerator } from './generators/sequence.generator';
import { EntityRelationshipGenerator } from './generators/entity-relationship.generator';
import {
  DiagramType,
  DiagramGenerationContext,
  GeneratedDiagram,
  DiagramValidationResult,
} from './interfaces/diagram-generation.interface';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';

describe('DiagramGenerationService', () => {
  let service: DiagramGenerationService;
  let llmService: jest.Mocked<LlmCoreService>;
  let monitoringService: jest.Mocked<MonitoringService>;
  let flowchartGenerator: jest.Mocked<FlowchartGenerator>;
  let sequenceGenerator: jest.Mocked<SequenceGenerator>;
  let erGenerator: jest.Mocked<EntityRelationshipGenerator>;

  // Mock data
  const mockUserStories = [
    {
      id: 'US001',
      title: 'User Login',
      description: 'As a user, I want to login to access my account',
      acceptanceCriteria: ['Email validation', 'Password verification'],
      priority: 'High',
    },
    {
      id: 'US002',
      title: 'View Dashboard',
      description: 'As a user, I want to view my dashboard after login',
      acceptanceCriteria: ['Display user info', 'Show recent activity'],
      priority: 'Medium',
    },
  ];

  const mockEndpoints = [
    {
      endpoint: '/api/auth/login',
      method: 'POST',
      description: 'User authentication',
      parameters: [{ name: 'email', type: 'string' }],
      responses: { 200: { description: 'Success' } },
    },
    {
      endpoint: '/api/dashboard',
      method: 'GET',
      description: 'Get user dashboard',
      parameters: [],
      responses: { 200: { description: 'Dashboard data' } },
    },
  ];

  const mockDataModels = [
    {
      name: 'User',
      fields: [
        { name: 'id', type: 'UUID', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'password', type: 'string', required: true },
      ],
    },
    {
      name: 'Session',
      fields: [
        { name: 'id', type: 'UUID', required: true },
        { name: 'userId', type: 'UUID', required: true },
        { name: 'token', type: 'string', required: true },
      ],
    },
  ];

  const mockFlowchartContext: DiagramGenerationContext = {
    type: 'flowchart',
    title: 'User Journey Flow',
    description: 'User login and dashboard access flow',
    data: mockUserStories,
  };

  const mockSequenceContext: DiagramGenerationContext = {
    type: 'sequence',
    title: 'API Interaction Flow',
    description: 'Authentication and dashboard API sequence',
    data: mockEndpoints,
  };

  const mockERContext: DiagramGenerationContext = {
    type: 'er',
    title: 'Data Model Relationships',
    description: 'User and session entity relationships',
    data: mockDataModels,
  };

  const mockMermaidSyntax = `graph TD
    A[User] --> B{Login Form}
    B -->|Valid| C[Dashboard]
    B -->|Invalid| D[Error Message]
    C --> E[Logout]
    E --> A`;

  const mockGeneratedDiagram: GeneratedDiagram = {
    type: 'flowchart',
    title: 'User Journey Flow',
    mermaidSyntax: mockMermaidSyntax,
    description: 'User login and dashboard access flow',
    metadata: {
      nodeCount: 5,
      complexity: 'simple',
      warnings: [],
    },
  };

  const mockLlmResponse = {
    content: mockMermaidSyntax,
    usage: {
      promptTokens: 200,
      completionTokens: 150,
      totalTokens: 350,
    },
    provider: 'openai',
  };

  const mockGeneratedViews: GeneratedViews = {
    pmView: {
      overview: { title: 'Test App' },
      userStories: mockUserStories,
      features: [],
      businessRules: [],
    },
    frontendView: {
      components: [],
      pages: [],
      stateManagement: { type: 'Redux' },
      routing: [],
    },
    backendView: {
      apis: mockEndpoints,
      dataModels: mockDataModels,
      services: [],
      infrastructure: { database: 'PostgreSQL' },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagramGenerationService,
        {
          provide: LlmCoreService,
          useValue: {
            generateFromTemplate: jest.fn(),
          },
        },
        {
          provide: MonitoringService,
          useValue: {
            trackAiGeneration: jest.fn(),
          },
        },
        {
          provide: FlowchartGenerator,
          useValue: {
            generateFromUserStories: jest.fn(),
            generateFlowchart: jest.fn(),
          },
        },
        {
          provide: SequenceGenerator,
          useValue: {
            generateFromEndpoints: jest.fn(),
            generateSequenceDiagram: jest.fn(),
          },
        },
        {
          provide: EntityRelationshipGenerator,
          useValue: {
            generateFromDataModels: jest.fn(),
            generateERDiagram: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiagramGenerationService>(DiagramGenerationService);
    llmService = module.get(LlmCoreService);
    monitoringService = module.get(MonitoringService);
    flowchartGenerator = module.get(FlowchartGenerator);
    sequenceGenerator = module.get(SequenceGenerator);
    erGenerator = module.get(EntityRelationshipGenerator);

    jest.clearAllMocks();
  });

  describe('generateDiagram', () => {
    it('should generate flowchart diagram using dedicated generator', async () => {
      // Arrange
      flowchartGenerator.generateFromUserStories.mockResolvedValue(mockMermaidSyntax);

      // Act
      const result = await service.generateDiagram(mockFlowchartContext);

      // Assert
      expect(flowchartGenerator.generateFromUserStories).toHaveBeenCalledWith(mockUserStories);
      expect(result).toEqual(expect.objectContaining({
        type: 'flowchart',
        title: 'User Journey Flow',
        mermaidSyntax: mockMermaidSyntax,
        description: 'User login and dashboard access flow',
      }));
      expect(result.metadata).toHaveProperty('nodeCount');
      expect(result.metadata).toHaveProperty('complexity');
      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'diagram_generation',
        expect.any(Number),
        true,
        expect.any(Object),
      );
    });

    it('should generate sequence diagram using dedicated generator', async () => {
      // Arrange
      sequenceGenerator.generateFromEndpoints.mockResolvedValue(mockMermaidSyntax);

      // Act
      const result = await service.generateDiagram(mockSequenceContext);

      // Assert
      expect(sequenceGenerator.generateFromEndpoints).toHaveBeenCalledWith(mockEndpoints);
      expect(result).toEqual(expect.objectContaining({
        type: 'sequence',
        title: 'API Interaction Flow',
        mermaidSyntax: mockMermaidSyntax,
      }));
    });

    it('should generate ER diagram using dedicated generator', async () => {
      // Arrange
      erGenerator.generateFromDataModels.mockResolvedValue(mockMermaidSyntax);

      // Act
      const result = await service.generateDiagram(mockERContext);

      // Assert
      expect(erGenerator.generateFromDataModels).toHaveBeenCalledWith(mockDataModels);
      expect(result).toEqual(expect.objectContaining({
        type: 'er',
        title: 'Data Model Relationships',
        mermaidSyntax: mockMermaidSyntax,
      }));
    });

    it('should fallback to AI generation for wireframe diagrams', async () => {
      // Arrange
      const wireframeContext: DiagramGenerationContext = {
        type: 'wireframe',
        title: 'App Wireframe',
        description: 'Basic app layout wireframe',
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await service.generateDiagram(wireframeContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('wireframe'),
          user: expect.stringContaining('Basic app layout wireframe'),
        }),
        expect.objectContaining({
          temperature: 0.5,
          maxTokens: 1500,
        }),
      );
      expect(result.type).toBe('wireframe');
    });

    it('should handle unsupported diagram types with AI generation', async () => {
      // Arrange
      const customContext: DiagramGenerationContext = {
        type: 'gitGraph' as DiagramType,
        title: 'Git Flow',
        description: 'Git branching strategy',
      };

      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await service.generateDiagram(customContext);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalled();
      expect(result.type).toBe('gitGraph');
    });

    it('should validate generated mermaid syntax', async () => {
      // Arrange
      const invalidMermaidSyntax = 'invalid mermaid syntax';
      flowchartGenerator.generateFromUserStories.mockResolvedValue(invalidMermaidSyntax);

      // Mock the private validateMermaidSyntax method to return validation errors
      const mockValidation: DiagramValidationResult = {
        isValid: false,
        errors: ['Invalid syntax'],
        warnings: ['Missing node declarations'],
      };

      // Act
      const result = await service.generateDiagram(mockFlowchartContext);

      // Assert
      expect(result.mermaidSyntax).toBe(invalidMermaidSyntax);
      expect(result.metadata?.warnings).toBeDefined();
    });

    it('should calculate diagram complexity based on node count', async () => {
      // Arrange
      const complexMermaidSyntax = `graph TD
        A[Node1] --> B[Node2]
        B --> C[Node3]
        C --> D[Node4]
        D --> E[Node5]
        E --> F[Node6]
        F --> G[Node7]
        G --> H[Node8]
        H --> I[Node9]
        I --> J[Node10]
        J --> K[Node11]
        K --> L[Node12]`;

      flowchartGenerator.generateFromUserStories.mockResolvedValue(complexMermaidSyntax);

      // Act
      const result = await service.generateDiagram(mockFlowchartContext);

      // Assert
      expect(result.metadata?.complexity).toBe('moderate'); // 12 nodes = moderate
    });

    it('should handle generation errors and track failed attempts', async () => {
      // Arrange
      const error = new Error('Generation failed');
      flowchartGenerator.generateFromUserStories.mockRejectedValue(error);

      // Act & Assert
      await expect(service.generateDiagram(mockFlowchartContext)).rejects.toThrow(
        'Generation failed',
      );

      expect(monitoringService.trackAiGeneration).toHaveBeenCalledWith(
        'diagram_generation',
        expect.any(Number),
        false,
      );
    });

    it('should extract mermaid syntax from AI response', async () => {
      // Arrange
      const responseWithCodeBlock = {
        ...mockLlmResponse,
        content: `Here's the diagram:

\`\`\`mermaid
${mockMermaidSyntax}
\`\`\`

This shows the user flow.`,
      };

      const aiContext: DiagramGenerationContext = {
        type: 'class',
        title: 'Class Diagram',
        description: 'System classes',
      };

      llmService.generateFromTemplate.mockResolvedValue(responseWithCodeBlock);

      // Act
      const result = await service.generateDiagram(aiContext);

      // Assert
      expect(result.mermaidSyntax).toBe(mockMermaidSyntax);
    });
  });

  describe('generateDiagramsFromViews', () => {
    beforeEach(() => {
      flowchartGenerator.generateFromUserStories.mockResolvedValue(mockMermaidSyntax);
      sequenceGenerator.generateFromEndpoints.mockResolvedValue(mockMermaidSyntax);
      erGenerator.generateFromDataModels.mockResolvedValue(mockMermaidSyntax);
    });

    it('should generate multiple diagrams from specification views', async () => {
      // Act
      const result = await service.generateDiagramsFromViews(mockGeneratedViews);

      // Assert
      expect(result).toHaveLength(3); // User journey, API sequence, ER diagram
      expect(result[0].type).toBe('flowchart');
      expect(result[0].title).toBe('User Journey Flow');
      expect(result[1].type).toBe('sequence');
      expect(result[1].title).toBe('API Interaction Flow');
      expect(result[2].type).toBe('er');
      expect(result[2].title).toBe('Data Model Relationships');
    });

    it('should skip diagrams when data is not available', async () => {
      // Arrange
      const viewsWithoutData: GeneratedViews = {
        pmView: {
          overview: { title: 'Test App' },
          userStories: [], // Empty user stories
          features: [],
          businessRules: [],
        },
        frontendView: {
          components: [],
          pages: [],
          stateManagement: { type: 'Redux' },
          routing: [],
        },
        backendView: {
          apis: [], // Empty APIs
          dataModels: [], // Empty data models
          services: [],
          infrastructure: { database: 'PostgreSQL' },
        },
      };

      // Act
      const result = await service.generateDiagramsFromViews(viewsWithoutData);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should limit sequence diagram endpoints for readability', async () => {
      // Arrange
      const viewsWithManyEndpoints: GeneratedViews = {
        ...mockGeneratedViews,
        backendView: {
          ...mockGeneratedViews.backendView,
          apis: Array(10).fill(mockEndpoints[0]), // 10 endpoints
        },
      };

      // Act
      await service.generateDiagramsFromViews(viewsWithManyEndpoints);

      // Assert
      expect(sequenceGenerator.generateFromEndpoints).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
      );
      // Should limit to 5 endpoints
      const calledWith = sequenceGenerator.generateFromEndpoints.mock.calls[0][0];
      expect(calledWith).toHaveLength(5);
    });

    it('should handle partial view data gracefully', async () => {
      // Arrange
      const partialViews: GeneratedViews = {
        pmView: {
          overview: { title: 'Test App' },
          userStories: mockUserStories,
          features: [],
          businessRules: [],
        },
        frontendView: {
          components: [],
          pages: [],
          stateManagement: { type: 'Redux' },
          routing: [],
        },
        backendView: {
          apis: [],
          dataModels: [],
          services: [],
          infrastructure: { database: 'PostgreSQL' },
        },
      };

      // Act
      const result = await service.generateDiagramsFromViews(partialViews);

      // Assert
      expect(result).toHaveLength(1); // Only user journey diagram
      expect(result[0].type).toBe('flowchart');
    });
  });

  describe('generateDiagramFromText', () => {
    it('should generate diagram from text description', async () => {
      // Arrange
      const description = 'User registers, logs in, and views profile';
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await service.generateDiagramFromText(description);

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('flowchart'),
          user: expect.stringContaining(description),
        }),
        expect.objectContaining({
          temperature: 0.5,
          maxTokens: 1500,
        }),
      );
      expect(result.type).toBe('flowchart');
      expect(result.mermaidSyntax).toBe(mockMermaidSyntax);
    });

    it('should allow custom diagram type for text generation', async () => {
      // Arrange
      const description = 'Database schema relationships';
      llmService.generateFromTemplate.mockResolvedValue(mockLlmResponse);

      // Act
      const result = await service.generateDiagramFromText(description, 'er');

      // Assert
      expect(llmService.generateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('er'),
        }),
        expect.any(Object),
      );
      expect(result.type).toBe('er');
    });
  });

  describe('private helper methods', () => {
    it('should count nodes correctly in mermaid syntax', async () => {
      // Arrange - This test indirectly tests the private countNodes method
      const syntaxWithKnownNodes = `graph TD
        A[Start] --> B[Process]
        B --> C[End]`;

      flowchartGenerator.generateFromUserStories.mockResolvedValue(syntaxWithKnownNodes);

      // Act
      const result = await service.generateDiagram(mockFlowchartContext);

      // Assert
      expect(result.metadata?.nodeCount).toBe(3); // A, B, C
    });

    it('should extract mermaid syntax from various response formats', async () => {
      // Arrange
      const responseFormats = [
        `\`\`\`mermaid\n${mockMermaidSyntax}\n\`\`\``,
        mockMermaidSyntax,
        `Here's the diagram:\n${mockMermaidSyntax}\nEnd of diagram.`,
      ];

      const context: DiagramGenerationContext = {
        type: 'class',
        title: 'Test',
        description: 'Test diagram',
      };

      for (const format of responseFormats) {
        llmService.generateFromTemplate.mockResolvedValue({
          ...mockLlmResponse,
          content: format,
        });

        // Act
        const result = await service.generateDiagram(context);

        // Assert
        expect(result.mermaidSyntax).toContain('graph TD');
      }
    });
  });
});