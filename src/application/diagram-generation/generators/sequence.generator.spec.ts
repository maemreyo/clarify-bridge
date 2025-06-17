// Test sequence diagram generation functionality

import { Test, TestingModule } from '@nestjs/testing';
import { SequenceGenerator } from './sequence.generator';

describe('SequenceGenerator', () => {
  let generator: SequenceGenerator;

  // Mock data
  const mockParticipants = [
    { id: 'client', name: 'Client Application', type: 'actor' as const },
    { id: 'api', name: 'API Gateway', type: 'participant' as const },
    { id: 'auth', name: 'Auth Service', type: 'participant' as const },
    { id: 'db', name: 'Database', type: 'database' as const },
  ];

  const mockMessages = [
    { from: 'client', to: 'api', message: 'POST /auth/login', type: 'sync' as const },
    { from: 'api', to: 'auth', message: 'validateCredentials()', type: 'sync' as const },
    { from: 'auth', to: 'db', message: 'findUser(email)', type: 'sync' as const },
    { from: 'db', to: 'auth', message: 'userData', type: 'return' as const },
    { from: 'auth', to: 'api', message: 'authToken', type: 'return' as const },
    { from: 'api', to: 'client', message: '200 OK + token', type: 'return' as const },
    {
      from: 'client',
      to: 'client',
      message: 'Store token locally',
      type: 'note' as const,
      notePosition: 'right of' as const,
    },
  ];

  const mockApiEndpoints = [
    {
      endpoint: '/api/auth/login',
      method: 'POST',
      description: 'User authentication endpoint',
      parameters: [
        { name: 'email', type: 'string', required: true },
        { name: 'password', type: 'string', required: true },
      ],
      responses: {
        200: { description: 'Login successful', schema: 'AuthToken' },
        401: { description: 'Invalid credentials' },
        400: { description: 'Validation error' },
      },
    },
    {
      endpoint: '/api/users/profile',
      method: 'GET',
      description: 'Get user profile information',
      parameters: [],
      responses: {
        200: { description: 'Profile data', schema: 'UserProfile' },
        401: { description: 'Unauthorized' },
        404: { description: 'User not found' },
      },
      authentication: 'Bearer token',
    },
    {
      endpoint: '/api/posts',
      method: 'POST',
      description: 'Create new post',
      parameters: [
        { name: 'title', type: 'string', required: true },
        { name: 'content', type: 'string', required: true },
        { name: 'tags', type: 'array', required: false },
      ],
      responses: {
        201: { description: 'Post created', schema: 'Post' },
        400: { description: 'Validation error' },
        401: { description: 'Unauthorized' },
      },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequenceGenerator],
    }).compile();

    generator = module.get<SequenceGenerator>(SequenceGenerator);
  });

  describe('generateSequenceDiagram', () => {
    it('should generate basic sequence diagram with participants and messages', () => {
      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, mockMessages);

      // Assert
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('actor client as Client Application');
      expect(result).toContain('participant api as API Gateway');
      expect(result).toContain('participant auth as Auth Service');
      expect(result).toContain('database db as Database');
    });

    it('should include all message types correctly', () => {
      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, mockMessages);

      // Assert
      expect(result).toContain('client->>api: POST /auth/login');
      expect(result).toContain('api->>auth: validateCredentials()');
      expect(result).toContain('auth->>db: findUser(email)');
      expect(result).toContain('db-->>auth: userData');
      expect(result).toContain('auth-->>api: authToken');
      expect(result).toContain('api-->>client: 200 OK + token');
      expect(result).toContain('note right of client: Store token locally');
    });

    it('should handle different participant types with correct prefixes', () => {
      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, mockMessages);

      // Assert
      expect(result).toContain('actor client as');
      expect(result).toContain('participant api as');
      expect(result).toContain('participant auth as');
      expect(result).toContain('database db as');
    });

    it('should handle async messages correctly', () => {
      // Arrange
      const asyncMessages = [
        { from: 'client', to: 'api', message: 'Background process', type: 'async' as const },
        { from: 'api', to: 'worker', message: 'Process in background', type: 'async' as const },
      ];
      const participants = [
        { id: 'client', name: 'Client', type: 'actor' as const },
        { id: 'api', name: 'API', type: 'participant' as const },
        { id: 'worker', name: 'Worker', type: 'participant' as const },
      ];

      // Act
      const result = generator.generateSequenceDiagram(participants, asyncMessages);

      // Assert
      expect(result).toContain('client-)api: Background process');
      expect(result).toContain('api-)worker: Process in background');
    });

    it('should handle return messages with dashed arrows', () => {
      // Arrange
      const returnMessages = [
        { from: 'service', to: 'client', message: 'Success response', type: 'return' as const },
        { from: 'db', to: 'service', message: 'Query result', type: 'return' as const },
      ];
      const participants = [
        { id: 'client', name: 'Client', type: 'actor' as const },
        { id: 'service', name: 'Service', type: 'participant' as const },
        { id: 'db', name: 'Database', type: 'database' as const },
      ];

      // Act
      const result = generator.generateSequenceDiagram(participants, returnMessages);

      // Assert
      expect(result).toContain('service-->>client: Success response');
      expect(result).toContain('db-->>service: Query result');
    });

    it('should handle notes with different positions', () => {
      // Arrange
      const notesMessages = [
        {
          from: 'client',
          to: 'client',
          message: 'Left note',
          type: 'note' as const,
          notePosition: 'left of' as const,
        },
        {
          from: 'api',
          to: 'api',
          message: 'Right note',
          type: 'note' as const,
          notePosition: 'right of' as const,
        },
        {
          from: 'db',
          to: 'db',
          message: 'Over note',
          type: 'note' as const,
          notePosition: 'over' as const,
        },
      ];

      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, notesMessages);

      // Assert
      expect(result).toContain('note left of client: Left note');
      expect(result).toContain('note right of api: Right note');
      expect(result).toContain('note over db: Over note');
    });

    it('should handle empty participants array', () => {
      // Act
      const result = generator.generateSequenceDiagram([], mockMessages);

      // Assert
      expect(result).toContain('sequenceDiagram');
      expect(
        result.split('\n').filter(line => line.includes('actor') || line.includes('participant'))
          .length,
      ).toBe(0);
    });

    it('should handle empty messages array', () => {
      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, []);

      // Assert
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('actor client as Client Application');
      // Should have participants but no messages
      expect(result.split('\n').filter(line => line.includes('->')).length).toBe(0);
    });

    it('should handle special characters in participant names and messages', () => {
      // Arrange
      const specialParticipants = [
        { id: 'api', name: 'API Gateway (v2.0)', type: 'participant' as const },
        { id: 'db', name: 'Database "Primary"', type: 'database' as const },
      ];
      const specialMessages = [
        { from: 'api', to: 'db', message: 'Query: SELECT * FROM "users"', type: 'sync' as const },
      ];

      // Act
      const result = generator.generateSequenceDiagram(specialParticipants, specialMessages);

      // Assert
      expect(result).toContain('participant api as API Gateway (v2.0)');
      expect(result).toContain('database db as Database "Primary"');
      expect(result).toContain('api->>db: Query: SELECT * FROM "users"');
    });

    it('should maintain consistent formatting with proper indentation', () => {
      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, mockMessages);

      // Assert
      const lines = result.split('\n');
      const participantLines = lines.filter(
        line => line.includes('actor') || line.includes('participant'),
      );
      const messageLines = lines.filter(line => line.includes('->') || line.includes('note'));

      // All participant and message lines should have consistent indentation
      participantLines.forEach(line => {
        expect(line).toMatch(/^\s{4}/); // 4 spaces indentation
      });
      messageLines.forEach(line => {
        expect(line).toMatch(/^\s{4}/); // 4 spaces indentation
      });
    });
  });

  describe('generateFromEndpoints', () => {
    it('should generate sequence diagram from API endpoints', () => {
      // Act
      const result = generator.generateFromEndpoints(mockApiEndpoints);

      // Assert
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('actor client as Client');
      expect(result).toContain('participant api as API Server');
      expect(result).toContain('database db as Database');
    });

    it('should include authentication flow for protected endpoints', () => {
      // Act
      const result = generator.generateFromEndpoints(mockApiEndpoints);

      // Assert
      expect(result).toContain('client->>api: POST /api/auth/login');
      expect(result).toContain('api-->>client: 200 (AuthToken)');
    });

    it('should show CRUD operations flow', () => {
      // Act
      const result = generator.generateFromEndpoints(mockApiEndpoints);

      // Assert
      expect(result).toContain('client->>api: GET /api/users/profile');
      expect(result).toContain('client->>api: POST /api/posts');
    });

    it('should handle different HTTP methods correctly', () => {
      // Arrange
      const httpMethodEndpoints = [
        { endpoint: '/api/users', method: 'GET', description: 'Get users' },
        { endpoint: '/api/users', method: 'POST', description: 'Create user' },
        { endpoint: '/api/users/123', method: 'PUT', description: 'Update user' },
        { endpoint: '/api/users/123', method: 'DELETE', description: 'Delete user' },
        { endpoint: '/api/users/123', method: 'PATCH', description: 'Partial update' },
      ];

      // Act
      const result = generator.generateFromEndpoints(httpMethodEndpoints);

      // Assert
      expect(result).toContain('GET /api/users');
      expect(result).toContain('POST /api/users');
      expect(result).toContain('PUT /api/users/123');
      expect(result).toContain('DELETE /api/users/123');
      expect(result).toContain('PATCH /api/users/123');
    });

    it('should include error responses in the flow', () => {
      // Act
      const result = generator.generateFromEndpoints(mockApiEndpoints);

      // Assert
      // Should include error handling notes or alternative flows
      expect(result).toContain('note over api: Handle 401/400 errors');
    });

    it('should handle endpoints with no authentication', () => {
      // Arrange
      const publicEndpoints = [
        { endpoint: '/api/health', method: 'GET', description: 'Health check' },
        { endpoint: '/api/public/info', method: 'GET', description: 'Public information' },
      ];

      // Act
      const result = generator.generateFromEndpoints(publicEndpoints);

      // Assert
      expect(result).toContain('client->>api: GET /api/health');
      expect(result).toContain('client->>api: GET /api/public/info');
    });

    it('should handle empty endpoints array', () => {
      // Act
      const result = generator.generateFromEndpoints([]);

      // Assert
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('actor client as Client');
      expect(result).toContain('participant api as API Server');
    });

    it('should group related endpoints logically', () => {
      // Act
      const result = generator.generateFromEndpoints(mockApiEndpoints);

      // Assert
      const lines = result.split('\n');
      const authIndex = lines.findIndex(line => line.includes('/auth/login'));
      const profileIndex = lines.findIndex(line => line.includes('/users/profile'));
      const postsIndex = lines.findIndex(line => line.includes('/posts'));

      // Auth should come first, then profile (authenticated), then posts
      expect(authIndex).toBeLessThan(profileIndex);
      expect(profileIndex).toBeLessThan(postsIndex);
    });

    it('should include database interactions for data operations', () => {
      // Act
      const result = generator.generateFromEndpoints(mockApiEndpoints);

      // Assert
      expect(result).toContain('api->>db: Query user data');
      expect(result).toContain('db-->>api: User data');
    });

    it('should handle endpoints with complex parameter structures', () => {
      // Arrange
      const complexEndpoints = [
        {
          endpoint: '/api/search',
          method: 'GET',
          description: 'Complex search',
          parameters: [
            { name: 'query', type: 'string', required: true },
            { name: 'filters', type: 'object', required: false },
            { name: 'pagination', type: 'object', required: false },
          ],
        },
      ];

      // Act
      const result = generator.generateFromEndpoints(complexEndpoints);

      // Assert
      expect(result).toContain('GET /api/search');
      expect(result).toContain('sequenceDiagram');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle participants with duplicate IDs', () => {
      // Arrange
      const duplicateParticipants = [
        { id: 'api', name: 'API v1', type: 'participant' as const },
        { id: 'api', name: 'API v2', type: 'participant' as const }, // Duplicate ID
      ];

      // Act
      const result = generator.generateSequenceDiagram(duplicateParticipants, []);

      // Assert
      expect(result).toContain('sequenceDiagram');
      // Should handle duplicates gracefully
    });

    it('should handle messages referencing non-existent participants', () => {
      // Arrange
      const invalidMessages = [
        { from: 'nonexistent', to: 'api', message: 'Invalid message', type: 'sync' as const },
        { from: 'client', to: 'missing', message: 'Another invalid', type: 'sync' as const },
      ];

      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, invalidMessages);

      // Assert
      expect(result).toContain('sequenceDiagram');
      // Should handle gracefully without breaking
    });

    it('should handle very long participant names and messages', () => {
      // Arrange
      const longNameParticipants = [
        {
          id: 'service',
          name: 'Very Long Service Name That Might Break Layout In Some Diagram Renderers',
          type: 'participant' as const,
        },
      ];
      const longMessages = [
        {
          from: 'service',
          to: 'service',
          message:
            'This is a very long message that describes a complex operation with many details and parameters',
          type: 'note' as const,
          notePosition: 'right of' as const,
        },
      ];

      // Act
      const result = generator.generateSequenceDiagram(longNameParticipants, longMessages);

      // Assert
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('participant service as Very Long Service Name');
    });

    it('should handle messages with special characters and escape them properly', () => {
      // Arrange
      const specialMessages = [
        {
          from: 'client',
          to: 'api',
          message: 'Message with "quotes" and \nnewlines',
          type: 'sync' as const,
        },
        {
          from: 'api',
          to: 'db',
          message: 'SQL: SELECT * FROM `users` WHERE id = ?',
          type: 'sync' as const,
        },
      ];

      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, specialMessages);

      // Assert
      expect(result).toContain('sequenceDiagram');
      // Should handle special characters without breaking syntax
    });

    it('should maintain valid Mermaid syntax for all generated diagrams', () => {
      // Act
      const result = generator.generateSequenceDiagram(mockParticipants, mockMessages);

      // Assert
      expect(result).toMatch(/^sequenceDiagram\n/);
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('null');

      // Check that each line is properly formatted
      const lines = result.split('\n').filter(line => line.trim().length > 0);
      lines.forEach(line => {
        expect(line).toMatch(
          /^\s*(sequenceDiagram|actor|participant|database|note|[a-zA-Z0-9_-]+(-{1,2}>{1,2}|\)|)[a-zA-Z0-9_-]+)/,
        );
      });
    });
  });

  describe('message formatting', () => {
    it('should use correct arrow types for different message types', () => {
      // Arrange
      const allMessageTypes = [
        { from: 'a', to: 'b', message: 'sync call', type: 'sync' as const },
        { from: 'a', to: 'b', message: 'async call', type: 'async' as const },
        { from: 'b', to: 'a', message: 'return value', type: 'return' as const },
      ];
      const simpleParticipants = [
        { id: 'a', name: 'Service A', type: 'participant' as const },
        { id: 'b', name: 'Service B', type: 'participant' as const },
      ];

      // Act
      const result = generator.generateSequenceDiagram(simpleParticipants, allMessageTypes);

      // Assert
      expect(result).toContain('a->>b: sync call');
      expect(result).toContain('a-)b: async call');
      expect(result).toContain('b-->>a: return value');
    });

    it('should handle self-messages (loops)', () => {
      // Arrange
      const selfMessages = [
        { from: 'service', to: 'service', message: 'Internal processing', type: 'sync' as const },
      ];
      const selfParticipants = [{ id: 'service', name: 'Service', type: 'participant' as const }];

      // Act
      const result = generator.generateSequenceDiagram(selfParticipants, selfMessages);

      // Assert
      expect(result).toContain('service->>service: Internal processing');
    });
  });
});
