// Test flowchart diagram generation functionality

import { Test, TestingModule } from '@nestjs/testing';
import { FlowchartGenerator } from './flowchart.generator';
import { DiagramOptions } from '../interfaces/diagram-generation.interface';

describe('FlowchartGenerator', () => {
  let generator: FlowchartGenerator;

  // Mock data
  const mockUserStories = [
    {
      id: 'US001',
      title: 'User Registration',
      description: 'As a new user, I want to register an account so that I can access the platform',
      acceptanceCriteria: [
        'Email validation works correctly',
        'Password meets security requirements',
        'Account activation email is sent',
      ],
    },
    {
      id: 'US002',
      title: 'User Login',
      description: 'As a registered user, I want to login to access my dashboard',
      acceptanceCriteria: [
        'Valid credentials allow access',
        'Invalid credentials show error message',
        'Remember me option works',
      ],
    },
    {
      id: 'US003',
      title: 'Password Reset',
      description: 'As a user, I want to reset my password if I forget it',
      acceptanceCriteria: [
        'Reset email is sent to valid email addresses',
        'Reset link expires after 24 hours',
        'New password is saved securely',
      ],
    },
  ];

  const mockNodes = [
    { id: 'start', label: 'Start Process', type: 'start' as const },
    { id: 'input', label: 'Get User Input', type: 'process' as const },
    { id: 'validate', label: 'Valid Input?', type: 'decision' as const },
    { id: 'process', label: 'Process Data', type: 'process' as const },
    { id: 'save', label: 'Save to Database', type: 'data' as const },
    { id: 'end', label: 'End Process', type: 'end' as const },
  ];

  const mockEdges = [
    { from: 'start', to: 'input' },
    { from: 'input', to: 'validate' },
    { from: 'validate', to: 'process', condition: 'Yes' },
    { from: 'validate', to: 'input', condition: 'No' },
    { from: 'process', to: 'save' },
    { from: 'save', to: 'end' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FlowchartGenerator],
    }).compile();

    generator = module.get<FlowchartGenerator>(FlowchartGenerator);
  });

  describe('generateFlowchart', () => {
    it('should generate basic flowchart with default options', () => {
      // Act
      const result = generator.generateFlowchart(mockNodes, mockEdges);

      // Assert
      expect(result).toContain('flowchart TB');
      expect(result).toContain('start((Start Process))');
      expect(result).toContain('input[Get User Input]');
      expect(result).toContain('validate{Valid Input?}');
      expect(result).toContain('process[Process Data]');
      expect(result).toContain('save[(Save to Database)]');
      expect(result).toContain('end((End Process))');
      expect(result).toContain('start --> input');
      expect(result).toContain('validate -->|Yes| process');
      expect(result).toContain('validate -->|No| input');
    });

    it('should generate flowchart with custom direction', () => {
      // Arrange
      const options: DiagramOptions = { direction: 'LR' };

      // Act
      const result = generator.generateFlowchart(mockNodes, mockEdges, options);

      // Assert
      expect(result).toContain('flowchart LR');
    });

    it('should generate flowchart with styles when requested', () => {
      // Arrange
      const options: DiagramOptions = { includeStyles: true };

      // Act
      const result = generator.generateFlowchart(mockNodes, mockEdges, options);

      // Assert
      expect(result).toContain('classDef startEnd');
      expect(result).toContain('classDef decision');
      expect(result).toContain('classDef process');
      expect(result).toContain('class start,end startEnd');
    });

    it('should handle different node types with correct shapes', () => {
      // Act
      const result = generator.generateFlowchart(mockNodes, mockEdges);

      // Assert
      expect(result).toContain('start((Start Process))'); // start/end nodes
      expect(result).toContain('end((End Process))');
      expect(result).toContain('validate{Valid Input?}'); // decision node
      expect(result).toContain('save[(Save to Database)]'); // data node
      expect(result).toContain('input[Get User Input]'); // process node
    });

    it('should handle edges with conditions', () => {
      // Act
      const result = generator.generateFlowchart(mockNodes, mockEdges);

      // Assert
      expect(result).toContain('validate -->|Yes| process');
      expect(result).toContain('validate -->|No| input');
    });

    it('should handle edges without conditions', () => {
      // Act
      const result = generator.generateFlowchart(mockNodes, mockEdges);

      // Assert
      expect(result).toContain('start --> input');
      expect(result).toContain('process --> save');
      expect(result).toContain('save --> end');
    });

    it('should escape special characters in labels', () => {
      // Arrange
      const nodesWithSpecialChars = [
        { id: 'node1', label: 'Label with "quotes" & <tags>', type: 'process' as const },
        { id: 'node2', label: "Label with 'apostrophes'", type: 'process' as const },
      ];
      const edges = [{ from: 'node1', to: 'node2' }];

      // Act
      const result = generator.generateFlowchart(nodesWithSpecialChars, edges);

      // Assert
      expect(result).toContain('&quot;');
      expect(result).toContain('&apos;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should handle multiline labels by converting to HTML breaks', () => {
      // Arrange
      const nodesWithMultiline = [
        { id: 'node1', label: 'Line 1\nLine 2\nLine 3', type: 'process' as const },
      ];
      const edges: any[] = [];

      // Act
      const result = generator.generateFlowchart(nodesWithMultiline, edges);

      // Assert
      expect(result).toContain('<br/>');
    });

    it('should handle empty nodes and edges arrays', () => {
      // Act
      const result = generator.generateFlowchart([], []);

      // Assert
      expect(result).toContain('flowchart TB');
      expect(result).not.toContain('class');
    });

    it('should support all direction options', () => {
      const directions: Array<'TB' | 'BT' | 'LR' | 'RL'> = ['TB', 'BT', 'LR', 'RL'];

      directions.forEach(direction => {
        // Act
        const result = generator.generateFlowchart(mockNodes, mockEdges, { direction });

        // Assert
        expect(result).toContain(`flowchart ${direction}`);
      });
    });
  });

  describe('generateFromUserStories', () => {
    it('should generate flowchart from user stories', () => {
      // Act
      const result = generator.generateFromUserStories(mockUserStories);

      // Assert
      expect(result).toContain('flowchart TB');
      expect(result).toContain('start((User Journey Start))');
      expect(result).toContain('story1[User Registration]');
      expect(result).toContain('story2[User Login]');
      expect(result).toContain('story3[Password Reset]');
      expect(result).toContain('end((Journey Complete))');
      expect(result).toContain('start --> story1');
      expect(result).toContain('story1 --> story2');
      expect(result).toContain('story2 --> story3');
      expect(result).toContain('story3 --> end');
    });

    it('should handle single user story', () => {
      // Arrange
      const singleStory = [mockUserStories[0]];

      // Act
      const result = generator.generateFromUserStories(singleStory);

      // Assert
      expect(result).toContain('start((User Journey Start))');
      expect(result).toContain('story1[User Registration]');
      expect(result).toContain('end((Journey Complete))');
      expect(result).toContain('start --> story1');
      expect(result).toContain('story1 --> end');
    });

    it('should handle empty user stories array', () => {
      // Act
      const result = generator.generateFromUserStories([]);

      // Assert
      expect(result).toContain('flowchart TB');
      expect(result).toContain('start((User Journey Start))');
      expect(result).toContain('end((Journey Complete))');
      expect(result).toContain('start --> end');
    });

    it('should use story titles as node labels', () => {
      // Act
      const result = generator.generateFromUserStories(mockUserStories);

      // Assert
      mockUserStories.forEach((story, index) => {
        expect(result).toContain(`story${index + 1}[${story.title}]`);
      });
    });

    it('should handle user stories with special characters in titles', () => {
      // Arrange
      const storiesWithSpecialChars = [
        {
          id: 'US001',
          title: 'User "Sign-up" & <Validation>',
          description: 'Test story',
          acceptanceCriteria: [],
        },
      ];

      // Act
      const result = generator.generateFromUserStories(storiesWithSpecialChars);

      // Assert
      expect(result).toContain('&quot;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should create sequential flow connecting all stories', () => {
      // Arrange
      const manyStories = Array(5).fill(null).map((_, index) => ({
        id: `US00${index + 1}`,
        title: `Story ${index + 1}`,
        description: `Description ${index + 1}`,
        acceptanceCriteria: [],
      }));

      // Act
      const result = generator.generateFromUserStories(manyStories);

      // Assert
      // Check that each story connects to the next
      for (let i = 1; i < manyStories.length; i++) {
        expect(result).toContain(`story${i} --> story${i + 1}`);
      }
      // Check start and end connections
      expect(result).toContain('start --> story1');
      expect(result).toContain(`story${manyStories.length} --> end`);
    });
  });

  describe('private helper methods', () => {
    it('should return correct node shapes for different types', () => {
      // This tests the private getNodeShape method indirectly through generateFlowchart
      const testNodes = [
        { id: 'start', label: 'Start', type: 'start' as const },
        { id: 'end', label: 'End', type: 'end' as const },
        { id: 'decision', label: 'Decision', type: 'decision' as const },
        { id: 'data', label: 'Data', type: 'data' as const },
        { id: 'process', label: 'Process', type: 'process' as const },
        { id: 'default', label: 'Default' }, // No type specified
      ];

      // Act
      const result = generator.generateFlowchart(testNodes, []);

      // Assert
      expect(result).toContain('start((Start))'); // start/end shape
      expect(result).toContain('end((End))');
      expect(result).toContain('decision{Decision}'); // decision shape
      expect(result).toContain('data[(Data)]'); // data shape
      expect(result).toContain('process[Process]'); // process shape
      expect(result).toContain('default[Default]'); // default shape
    });

    it('should properly escape all special characters', () => {
      // This tests the private escapeLabel method indirectly
      const nodeWithAllSpecialChars = [
        {
          id: 'test',
          label: '"quotes" \'apostrophes\' <tags> >more< & ampersand \n newline',
          type: 'process' as const
        },
      ];

      // Act
      const result = generator.generateFlowchart(nodeWithAllSpecialChars, []);

      // Assert
      expect(result).toContain('&quot;');
      expect(result).toContain('&apos;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('<br/>');
    });

    it('should include default styles with proper CSS classes', () => {
      // Arrange
      const options: DiagramOptions = { includeStyles: true };

      // Act
      const result = generator.generateFlowchart(mockNodes, mockEdges, options);

      // Assert
      expect(result).toContain('classDef startEnd fill:#90EE90');
      expect(result).toContain('classDef decision fill:#FFE4B5');
      expect(result).toContain('classDef process fill:#87CEEB');
      expect(result).toContain('stroke:#333,stroke-width:2px');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle nodes with missing labels', () => {
      // Arrange
      const nodesWithMissingLabels = [
        { id: 'node1', label: '', type: 'process' as const },
        { id: 'node2', label: undefined as any, type: 'process' as const },
      ];
      const edges = [{ from: 'node1', to: 'node2' }];

      // Act & Assert - Should not throw error
      expect(() => generator.generateFlowchart(nodesWithMissingLabels, edges)).not.toThrow();
    });

    it('should handle edges referencing non-existent nodes', () => {
      // Arrange
      const invalidEdges = [
        { from: 'nonexistent1', to: 'nonexistent2' },
        { from: 'start', to: 'nonexistent3' },
      ];

      // Act & Assert - Should not throw error
      expect(() => generator.generateFlowchart(mockNodes, invalidEdges)).not.toThrow();
    });

    it('should handle very long labels gracefully', () => {
      // Arrange
      const longLabel = 'A'.repeat(1000);
      const nodeWithLongLabel = [
        { id: 'long', label: longLabel, type: 'process' as const },
      ];

      // Act & Assert - Should not throw error
      expect(() => generator.generateFlowchart(nodeWithLongLabel, [])).not.toThrow();
      const result = generator.generateFlowchart(nodeWithLongLabel, []);
      expect(result).toContain(longLabel);
    });

    it('should handle user stories with missing required fields', () => {
      // Arrange
      const invalidUserStories = [
        { id: 'US001', title: '', description: 'desc', acceptanceCriteria: [] },
        { id: 'US002', title: undefined as any, description: 'desc', acceptanceCriteria: [] },
      ] as any[];

      // Act & Assert - Should not throw error
      expect(() => generator.generateFromUserStories(invalidUserStories)).not.toThrow();
    });
  });
});