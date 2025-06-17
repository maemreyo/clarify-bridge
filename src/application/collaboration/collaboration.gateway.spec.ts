// Test WebSocket collaboration gateway for real-time events

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';
import { PrismaService } from '@core/database';
import { Server, Socket } from 'socket.io';

describe('CollaborationGateway', () => {
  let gateway: CollaborationGateway;
  let collaborationService: jest.Mocked<CollaborationService>;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: jest.Mocked<PrismaService>;

  // Mock socket and server
  let mockSocket: jest.Mocked<Socket>;
  let mockServer: jest.Mocked<Server>;

  // Mock data
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
  };

  const mockTeamMemberships = [
    {
      teamId: 'team-456',
      userId: mockUser.id,
      team: { id: 'team-456', name: 'Test Team' },
    },
    {
      teamId: 'team-789',
      userId: mockUser.id,
      team: { id: 'team-789', name: 'Another Team' },
    },
  ];

  const mockSpecification = {
    id: 'spec-123',
    title: 'Test Specification',
    authorId: mockUser.id,
    teamId: 'team-456',
  };

  const mockComment = {
    id: 'comment-123',
    content: 'This is a test comment',
    section: 'pm_view',
    authorId: mockUser.id,
    specificationId: mockSpecification.id,
    author: mockUser,
  };

  const mockJwtPayload = {
    sub: mockUser.id,
    email: mockUser.email,
    iat: 1640995200,
    exp: 1641081600,
  };

  beforeEach(async () => {
    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: { token: 'valid-jwt-token' },
      },
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      disconnect: jest.fn(),
      broadcast: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
    } as any;

    // Create mock server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      in: jest.fn().mockReturnThis(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationGateway,
        {
          provide: CollaborationService,
          useValue: {
            addComment: jest.fn(),
            updateComment: jest.fn(),
            deleteComment: jest.fn(),
            getComments: jest.fn(),
            getReviews: jest.fn(),
            createReview: jest.fn(),
            submitReview: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            teamMember: {
              findMany: jest.fn(),
            },
            specification: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    gateway = module.get<CollaborationGateway>(CollaborationGateway);
    collaborationService = module.get(CollaborationService);
    jwtService = module.get(JwtService);
    prismaService = module.get(PrismaService);

    // Set the server
    gateway.server = mockServer;

    jest.clearAllMocks();
  });

  describe('afterInit', () => {
    it('should log gateway initialization', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      // Act
      gateway.afterInit(mockServer);

      // Assert
      expect(logSpy).toHaveBeenCalledWith('WebSocket Gateway initialized');
    });
  });

  describe('handleConnection', () => {
    beforeEach(() => {
      jwtService.verify.mockReturnValue(mockJwtPayload);
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.teamMember.findMany.mockResolvedValue(mockTeamMemberships as any);
    });

    it('should handle successful connection', async () => {
      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(mockSocket.data.userId).toBe(mockUser.id);
      expect(mockSocket.data.email).toBe(mockUser.email);
      expect(mockSocket.join).toHaveBeenCalledWith(`user:${mockUser.id}`);
      expect(mockSocket.join).toHaveBeenCalledWith('team:team-456');
      expect(mockSocket.join).toHaveBeenCalledWith('team:team-789');
    });

    it('should handle invalid JWT token', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const logSpy = jest.spyOn(gateway['logger'], 'error');

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(logSpy).toHaveBeenCalledWith('Connection error: Invalid token');
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle missing token', async () => {
      // Arrange
      mockSocket.handshake.auth.token = undefined;

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should join team rooms based on user memberships', async () => {
      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(prismaService.teamMember.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        include: { team: true },
      });
      expect(mockSocket.join).toHaveBeenCalledWith('team:team-456');
      expect(mockSocket.join).toHaveBeenCalledWith('team:team-789');
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      // Act
      gateway.handleDisconnect(mockSocket);

      // Assert
      expect(logSpy).toHaveBeenCalledWith(`Client disconnected: ${mockSocket.id}`);
    });
  });

  describe('joinSpecification', () => {
    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification as any);
    });

    it('should join specification room successfully', async () => {
      // Act
      await gateway.joinSpecification(mockSocket, {
        specificationId: mockSpecification.id,
      });

      // Assert
      expect(prismaService.specification.findUnique).toHaveBeenCalledWith({
        where: { id: mockSpecification.id },
        include: {
          author: true,
          team: {
            include: {
              members: true,
            },
          },
        },
      });
      expect(mockSocket.join).toHaveBeenCalledWith(`specification:${mockSpecification.id}`);
      expect(mockSocket.broadcast.to).toHaveBeenCalledWith(`specification:${mockSpecification.id}`);
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user:joined', {
        userId: mockUser.id,
        specificationId: mockSpecification.id,
      });
    });

    it('should throw WsException when specification not found', async () => {
      // Arrange
      prismaService.specification.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        gateway.joinSpecification(mockSocket, { specificationId: 'non-existent' }),
      ).rejects.toThrow(WsException);
    });

    it('should throw WsException when user has no access', async () => {
      // Arrange
      const unauthorizedSpec = {
        ...mockSpecification,
        authorId: 'other-user',
        team: {
          id: 'team-456',
          members: [{ userId: 'other-user' }],
        },
      };
      prismaService.specification.findUnique.mockResolvedValue(unauthorizedSpec as any);

      // Act & Assert
      await expect(
        gateway.joinSpecification(mockSocket, { specificationId: mockSpecification.id }),
      ).rejects.toThrow(WsException);
    });
  });

  describe('leaveSpecification', () => {
    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
    });

    it('should leave specification room successfully', async () => {
      // Act
      await gateway.leaveSpecification(mockSocket, {
        specificationId: mockSpecification.id,
      });

      // Assert
      expect(mockSocket.leave).toHaveBeenCalledWith(`specification:${mockSpecification.id}`);
      expect(mockSocket.broadcast.to).toHaveBeenCalledWith(`specification:${mockSpecification.id}`);
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user:left', {
        userId: mockUser.id,
        specificationId: mockSpecification.id,
      });
    });
  });

  describe('addComment', () => {
    const commentData = {
      specificationId: mockSpecification.id,
      content: 'This is a new comment',
      section: 'frontend_view',
    };

    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
      collaborationService.addComment.mockResolvedValue(mockComment as any);
    });

    it('should add comment and broadcast to specification room', async () => {
      // Act
      await gateway.addComment(mockSocket, commentData);

      // Assert
      expect(collaborationService.addComment).toHaveBeenCalledWith(
        commentData.specificationId,
        mockUser.id,
        {
          content: commentData.content,
          section: commentData.section,
        },
      );

      expect(mockServer.to).toHaveBeenCalledWith(`specification:${commentData.specificationId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('comment:added', mockComment);
    });

    it('should handle comment creation errors', async () => {
      // Arrange
      collaborationService.addComment.mockRejectedValue(new Error('Comment creation failed'));

      // Act & Assert
      await expect(gateway.addComment(mockSocket, commentData)).rejects.toThrow(
        'Comment creation failed',
      );
    });
  });

  describe('updateComment', () => {
    const updateData = {
      commentId: mockComment.id,
      content: 'Updated comment content',
      resolved: true,
    };

    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
      collaborationService.updateComment.mockResolvedValue({
        ...mockComment,
        content: updateData.content,
        resolved: updateData.resolved,
      } as any);
    });

    it('should update comment and broadcast to specification room', async () => {
      // Act
      await gateway.updateComment(mockSocket, updateData);

      // Assert
      expect(collaborationService.updateComment).toHaveBeenCalledWith(
        updateData.commentId,
        mockUser.id,
        {
          content: updateData.content,
          resolved: updateData.resolved,
        },
      );

      expect(mockServer.to).toHaveBeenCalledWith(`specification:${mockComment.specificationId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('comment:updated', expect.objectContaining({
        id: mockComment.id,
        content: updateData.content,
        resolved: updateData.resolved,
      }));
    });
  });

  describe('deleteComment', () => {
    const deleteData = {
      commentId: mockComment.id,
    };

    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
      collaborationService.deleteComment.mockResolvedValue(mockComment as any);
    });

    it('should delete comment and broadcast to specification room', async () => {
      // Act
      await gateway.deleteComment(mockSocket, deleteData);

      // Assert
      expect(collaborationService.deleteComment).toHaveBeenCalledWith(
        deleteData.commentId,
        mockUser.id,
      );

      expect(mockServer.to).toHaveBeenCalledWith(`specification:${mockComment.specificationId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('comment:deleted', {
        commentId: mockComment.id,
        specificationId: mockComment.specificationId,
      });
    });
  });

  describe('typing events', () => {
    const typingData = {
      specificationId: mockSpecification.id,
      section: 'pm_view',
    };

    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
    });

    it('should broadcast typing start event', async () => {
      // Act
      await gateway.handleTypingStart(mockSocket, typingData);

      // Assert
      expect(mockSocket.broadcast.to).toHaveBeenCalledWith(
        `specification:${typingData.specificationId}`,
      );
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('typing:start', {
        userId: mockUser.id,
        specificationId: typingData.specificationId,
        section: typingData.section,
      });
    });

    it('should broadcast typing stop event', async () => {
      // Act
      await gateway.handleTypingStop(mockSocket, typingData);

      // Assert
      expect(mockSocket.broadcast.to).toHaveBeenCalledWith(
        `specification:${typingData.specificationId}`,
      );
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('typing:stop', {
        userId: mockUser.id,
        specificationId: typingData.specificationId,
        section: typingData.section,
      });
    });
  });

  describe('cursor events', () => {
    const cursorData = {
      specificationId: mockSpecification.id,
      section: 'frontend_view',
      position: { line: 10, character: 5 },
    };

    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
    });

    it('should broadcast cursor position', async () => {
      // Act
      await gateway.handleCursorMove(mockSocket, cursorData);

      // Assert
      expect(mockSocket.broadcast.to).toHaveBeenCalledWith(
        `specification:${cursorData.specificationId}`,
      );
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('cursor:move', {
        userId: mockUser.id,
        specificationId: cursorData.specificationId,
        section: cursorData.section,
        position: cursorData.position,
      });
    });
  });

  describe('review events', () => {
    const reviewData = {
      specificationId: mockSpecification.id,
      reviewerId: 'reviewer-456',
      message: 'Please review this specification',
    };

    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
      collaborationService.createReview.mockResolvedValue({
        id: 'review-123',
        ...reviewData,
        status: 'PENDING',
      } as any);
    });

    it('should create review and notify reviewer', async () => {
      // Act
      await gateway.createReview(mockSocket, reviewData);

      // Assert
      expect(collaborationService.createReview).toHaveBeenCalledWith(
        reviewData.specificationId,
        mockUser.id,
        {
          reviewerId: reviewData.reviewerId,
          message: reviewData.message,
        },
      );

      expect(mockServer.to).toHaveBeenCalledWith(`user:${reviewData.reviewerId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('review:requested', expect.objectContaining({
        id: 'review-123',
        specificationId: reviewData.specificationId,
      }));
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      collaborationService.addComment.mockRejectedValue(new Error('Database error'));
      const errorSpy = jest.spyOn(gateway['logger'], 'error');

      // Act
      try {
        await gateway.addComment(mockSocket, {
          specificationId: mockSpecification.id,
          content: 'Test comment',
          section: 'pm_view',
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle missing userId in socket data', async () => {
      // Arrange
      mockSocket.data.userId = undefined;

      // Act & Assert
      await expect(
        gateway.addComment(mockSocket, {
          specificationId: mockSpecification.id,
          content: 'Test comment',
          section: 'pm_view',
        }),
      ).rejects.toThrow(WsException);
    });
  });

  describe('room management', () => {
    beforeEach(() => {
      mockSocket.data.userId = mockUser.id;
    });

    it('should handle multiple users in same specification', async () => {
      // Arrange
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification as any);

      // Act
      await gateway.joinSpecification(mockSocket, {
        specificationId: mockSpecification.id,
      });

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith(`specification:${mockSpecification.id}`);
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user:joined', {
        userId: mockUser.id,
        specificationId: mockSpecification.id,
      });
    });

    it('should broadcast to team rooms for team notifications', async () => {
      // Act
      await gateway.notifyTeam('team-456', 'team:update', { message: 'Team update' });

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('team:team-456');
      expect(mockServer.emit).toHaveBeenCalledWith('team:update', { message: 'Team update' });
    });
  });
});