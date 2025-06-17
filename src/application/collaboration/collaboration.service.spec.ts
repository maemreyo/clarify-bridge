// Test collaboration features and real-time communication

import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationService } from './collaboration.service';
import { PrismaService } from '@core/database';
import { NotificationService } from '@core/notification';
import { MonitoringService } from '@core/monitoring';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CreateReviewDto,
  SubmitReviewDto,
  CommentFilterDto,
} from './dto/collaboration.dto';
import { ReviewStatus, NotificationType, Comment, Review } from '@prisma/client';

describe('CollaborationService', () => {
  let service: CollaborationService;
  let prismaService: jest.Mocked<PrismaService>;
  let notificationService: jest.Mocked<NotificationService>;
  let monitoringService: jest.Mocked<MonitoringService>;

  // Mock data
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
  };

  const mockSpecification = {
    id: 'spec-456',
    title: 'Test Specification',
    authorId: mockUser.id,
    teamId: 'team-789',
    status: 'DRAFT',
    author: mockUser,
    team: {
      id: 'team-789',
      name: 'Test Team',
      members: [
        { userId: mockUser.id, role: 'OWNER' },
        { userId: 'user-456', role: 'MEMBER' },
      ],
    },
  };

  const mockComment: Comment = {
    id: 'comment-123',
    content: 'This is a great specification!',
    section: 'pm_view',
    authorId: mockUser.id,
    specificationId: mockSpecification.id,
    parentId: null,
    resolved: false,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockReview: Review = {
    id: 'review-123',
    specificationId: mockSpecification.id,
    reviewerId: 'reviewer-456',
    requesterId: mockUser.id,
    status: ReviewStatus.PENDING,
    feedback: null,
    dueDate: new Date('2024-01-20T00:00:00Z'),
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    message: 'Please review this specification',
  };

  const mockCommentWithAuthor = {
    ...mockComment,
    author: {
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      avatar: mockUser.avatar,
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      comment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      review: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      specification: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      teamMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationService,
          useValue: {
            sendNotification: jest.fn(),
            sendBulkNotifications: jest.fn(),
          },
        },
        {
          provide: MonitoringService,
          useValue: {
            trackUserActivity: jest.fn(),
            trackCollaborationEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CollaborationService>(CollaborationService);
    prismaService = module.get(PrismaService);
    notificationService = module.get(NotificationService);
    monitoringService = module.get(MonitoringService);

    jest.clearAllMocks();
  });

  describe('addComment', () => {
    const createCommentDto: CreateCommentDto = {
      content: 'This looks good to me!',
      section: 'frontend_view',
      parentId: null,
    };

    beforeEach(() => {
      // Mock specification access check
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification as any);
      prismaService.comment.create.mockResolvedValue(mockCommentWithAuthor as any);
    });

    it('should add comment successfully', async () => {
      // Act
      const result = await service.addComment(
        mockSpecification.id,
        mockUser.id,
        createCommentDto,
      );

      // Assert
      expect(prismaService.specification.findUnique).toHaveBeenCalledWith({
        where: { id: mockSpecification.id },
        include: {
          author: { select: { id: true, name: true, email: true } },
          team: {
            include: {
              members: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
          },
        },
      });

      expect(prismaService.comment.create).toHaveBeenCalledWith({
        data: {
          content: createCommentDto.content,
          section: createCommentDto.section,
          authorId: mockUser.id,
          specificationId: mockSpecification.id,
          parentId: createCommentDto.parentId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      expect(result).toEqual(mockCommentWithAuthor);
      expect(monitoringService.trackUserActivity).toHaveBeenCalledWith(
        mockUser.id,
        'comment.added',
        {
          specificationId: mockSpecification.id,
          commentId: mockCommentWithAuthor.id,
          section: createCommentDto.section,
        },
      );
    });

    it('should add reply comment with parentId', async () => {
      // Arrange
      const replyDto: CreateCommentDto = {
        ...createCommentDto,
        parentId: 'parent-comment-123',
      };

      // Act
      await service.addComment(mockSpecification.id, mockUser.id, replyDto);

      // Assert
      expect(prismaService.comment.create).toHaveBeenCalledWith({
        data: {
          content: replyDto.content,
          section: replyDto.section,
          authorId: mockUser.id,
          specificationId: mockSpecification.id,
          parentId: replyDto.parentId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });
    });

    it('should send notifications to team members', async () => {
      // Act
      await service.addComment(mockSpecification.id, mockUser.id, createCommentDto);

      // Assert
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException when specification does not exist', async () => {
      // Arrange
      prismaService.specification.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.addComment(mockSpecification.id, mockUser.id, createCommentDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      // Arrange
      const unauthorizedSpec = {
        ...mockSpecification,
        authorId: 'other-user',
        team: {
          ...mockSpecification.team,
          members: [{ userId: 'other-user', role: 'OWNER' }],
        },
      };
      prismaService.specification.findUnique.mockResolvedValue(unauthorizedSpec as any);

      // Act & Assert
      await expect(
        service.addComment(mockSpecification.id, mockUser.id, createCommentDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle empty comment content', async () => {
      // Arrange
      const emptyCommentDto: CreateCommentDto = {
        content: '',
        section: 'pm_view',
      };

      // Act & Assert
      await expect(
        service.addComment(mockSpecification.id, mockUser.id, emptyCommentDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getComments', () => {
    const commentFilter: CommentFilterDto = {
      section: 'pm_view',
      resolved: false,
      includeReplies: true,
    };

    const mockComments = [
      {
        ...mockCommentWithAuthor,
        replies: [
          {
            id: 'reply-123',
            content: 'I agree!',
            parentId: mockComment.id,
            author: mockUser,
          },
        ],
      },
    ];

    beforeEach(() => {
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification as any);
      prismaService.comment.findMany.mockResolvedValue(mockComments as any);
    });

    it('should get comments with filters successfully', async () => {
      // Act
      const result = await service.getComments(
        mockSpecification.id,
        mockUser.id,
        commentFilter,
      );

      // Assert
      expect(prismaService.comment.findMany).toHaveBeenCalledWith({
        where: {
          specificationId: mockSpecification.id,
          section: commentFilter.section,
          resolved: commentFilter.resolved,
          parentId: null, // Only top-level comments
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockComments);
    });

    it('should get comments without replies when includeReplies is false', async () => {
      // Arrange
      const filterWithoutReplies: CommentFilterDto = {
        ...commentFilter,
        includeReplies: false,
      };

      // Act
      await service.getComments(mockSpecification.id, mockUser.id, filterWithoutReplies);

      // Assert
      expect(prismaService.comment.findMany).toHaveBeenCalledWith({
        where: {
          specificationId: mockSpecification.id,
          section: commentFilter.section,
          resolved: commentFilter.resolved,
          parentId: null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should get all comments when no filters provided', async () => {
      // Arrange
      const emptyFilter: CommentFilterDto = {};

      // Act
      await service.getComments(mockSpecification.id, mockUser.id, emptyFilter);

      // Assert
      expect(prismaService.comment.findMany).toHaveBeenCalledWith({
        where: {
          specificationId: mockSpecification.id,
          parentId: null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateComment', () => {
    const updateCommentDto: UpdateCommentDto = {
      content: 'Updated comment content',
      resolved: true,
    };

    beforeEach(() => {
      prismaService.comment.findUnique.mockResolvedValue(mockComment as any);
      prismaService.comment.update.mockResolvedValue({
        ...mockComment,
        ...updateCommentDto,
      } as any);
    });

    it('should update comment successfully', async () => {
      // Act
      const result = await service.updateComment(
        mockComment.id,
        mockUser.id,
        updateCommentDto,
      );

      // Assert
      expect(prismaService.comment.findUnique).toHaveBeenCalledWith({
        where: { id: mockComment.id },
        include: { author: true },
      });

      expect(prismaService.comment.update).toHaveBeenCalledWith({
        where: { id: mockComment.id },
        data: updateCommentDto,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      expect(result.content).toBe(updateCommentDto.content);
      expect(result.resolved).toBe(updateCommentDto.resolved);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      // Arrange
      prismaService.comment.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateComment(mockComment.id, mockUser.id, updateCommentDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the author', async () => {
      // Arrange
      const otherUserComment = {
        ...mockComment,
        authorId: 'other-user-123',
        author: { id: 'other-user-123', name: 'Other User' },
      };
      prismaService.comment.findUnique.mockResolvedValue(otherUserComment as any);

      // Act & Assert
      await expect(
        service.updateComment(mockComment.id, mockUser.id, updateCommentDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow partial updates', async () => {
      // Arrange
      const partialUpdate: UpdateCommentDto = {
        resolved: true,
      };

      // Act
      await service.updateComment(mockComment.id, mockUser.id, partialUpdate);

      // Assert
      expect(prismaService.comment.update).toHaveBeenCalledWith({
        where: { id: mockComment.id },
        data: partialUpdate,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });
    });
  });

  describe('createReview', () => {
    const createReviewDto: CreateReviewDto = {
      reviewerId: 'reviewer-456',
      message: 'Please review this specification',
      dueDate: '2024-01-20T00:00:00Z',
    };

    beforeEach(() => {
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification as any);
      prismaService.user.findUnique.mockResolvedValue({
        id: createReviewDto.reviewerId,
        name: 'Reviewer User',
        email: 'reviewer@example.com',
      } as any);
      prismaService.review.create.mockResolvedValue(mockReview as any);
    });

    it('should create review request successfully', async () => {
      // Act
      const result = await service.createReview(
        mockSpecification.id,
        mockUser.id,
        createReviewDto,
      );

      // Assert
      expect(prismaService.review.create).toHaveBeenCalledWith({
        data: {
          specificationId: mockSpecification.id,
          reviewerId: createReviewDto.reviewerId,
          requesterId: mockUser.id,
          message: createReviewDto.message,
          dueDate: new Date(createReviewDto.dueDate),
          status: ReviewStatus.PENDING,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          specification: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      expect(result).toEqual(mockReview);
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException when reviewer does not exist', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createReview(mockSpecification.id, mockUser.id, createReviewDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent self-review', async () => {
      // Arrange
      const selfReviewDto: CreateReviewDto = {
        ...createReviewDto,
        reviewerId: mockUser.id,
      };

      // Act & Assert
      await expect(
        service.createReview(mockSpecification.id, mockUser.id, selfReviewDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitReview', () => {
    const submitReviewDto: SubmitReviewDto = {
      status: ReviewStatus.APPROVED,
      feedback: 'Looks good! Approved.',
    };

    beforeEach(() => {
      prismaService.review.findUnique.mockResolvedValue(mockReview as any);
      prismaService.review.update.mockResolvedValue({
        ...mockReview,
        ...submitReviewDto,
      } as any);
    });

    it('should submit review successfully', async () => {
      // Act
      const result = await service.submitReview(
        mockReview.id,
        mockReview.reviewerId,
        submitReviewDto,
      );

      // Assert
      expect(prismaService.review.update).toHaveBeenCalledWith({
        where: { id: mockReview.id },
        data: {
          status: submitReviewDto.status,
          feedback: submitReviewDto.feedback,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          specification: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      expect(result.status).toBe(submitReviewDto.status);
      expect(result.feedback).toBe(submitReviewDto.feedback);
    });

    it('should throw ForbiddenException when user is not the reviewer', async () => {
      // Act & Assert
      await expect(
        service.submitReview(mockReview.id, 'wrong-user-id', submitReviewDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when review is already completed', async () => {
      // Arrange
      const completedReview = {
        ...mockReview,
        status: ReviewStatus.APPROVED,
      };
      prismaService.review.findUnique.mockResolvedValue(completedReview as any);

      // Act & Assert
      await expect(
        service.submitReview(mockReview.id, mockReview.reviewerId, submitReviewDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCollaborationStats', () => {
    beforeEach(() => {
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification as any);
      prismaService.comment.findMany.mockResolvedValue([mockComment, mockComment] as any);
      prismaService.review.findMany.mockResolvedValue([mockReview] as any);
    });

    it('should return collaboration statistics', async () => {
      // Act
      const result = await service.getCollaborationStats(mockSpecification.id, mockUser.id);

      // Assert
      expect(result).toEqual({
        totalComments: 2,
        unresolvedComments: 2,
        totalReviews: 1,
        pendingReviews: 1,
        approvedReviews: 0,
        rejectedReviews: 0,
        activeCollaborators: 2,
      });
    });
  });

  describe('getPendingReviews', () => {
    beforeEach(() => {
      prismaService.review.findMany.mockResolvedValue([mockReview] as any);
    });

    it('should get pending reviews for user', async () => {
      // Act
      const result = await service.getPendingReviews(mockUser.id);

      // Assert
      expect(prismaService.review.findMany).toHaveBeenCalledWith({
        where: {
          reviewerId: mockUser.id,
          status: ReviewStatus.PENDING,
        },
        include: {
          specification: {
            select: {
              id: true,
              title: true,
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      });

      expect(result).toEqual([mockReview]);
    });
  });
});