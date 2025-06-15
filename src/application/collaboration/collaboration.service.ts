// Updated: Main collaboration service

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database';
import { NotificationService } from '@core/notification';
import { MonitoringService } from '@core/monitoring';
import { Comment, Review, ReviewStatus, NotificationType, Prisma } from '@prisma/client';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CreateReviewDto,
  SubmitReviewDto,
  CommentFilterDto,
} from './dto/collaboration.dto';
import {
  CommentThread,
  ReviewRequest,
  ReviewDecision,
  CollaborationStats,
} from './interfaces/collaboration.interface';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private monitoringService: MonitoringService,
  ) {}

  // Comment Management

  /**
   * Add comment to specification
   */
  async addComment(
    specificationId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    // Verify specification exists and user has access
    const specification = await this.getSpecificationWithAccess(specificationId, userId);

    // Create comment
    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        section: dto.section,
        authorId: userId,
        specificationId,
        parentId: dto.parentId,
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

    // Send notifications
    await this.notifyCommentAdded(specification, comment);

    // Track activity
    await this.monitoringService.trackUserActivity(userId, 'comment.added', {
      specificationId,
      commentId: comment.id,
      section: dto.section,
    });

    this.logger.log(`Comment added to specification ${specificationId}`);

    return comment;
  }

  /**
   * Get comments for specification
   */
  async getComments(
    specificationId: string,
    userId: string,
    filter: CommentFilterDto,
  ): Promise<CommentThread[]> {
    // Verify access
    await this.getSpecificationWithAccess(specificationId, userId);

    const where: Prisma.CommentWhereInput = {
      specificationId,
      parentId: null, // Get only top-level comments
    };

    if (filter.section) {
      where.section = filter.section;
    }

    if (filter.resolved !== undefined) {
      where.resolved = filter.resolved;
    }

    const comments = await this.prisma.comment.findMany({
      where,
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

    // Build comment threads if requested
    if (filter.includeReplies) {
      const threads = await Promise.all(
        comments.map(comment => this.buildCommentThread(comment)),
      );
      return threads;
    }

    return comments.map(comment => ({ comment }));
  }

  /**
   * Update comment
   */
  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { specification: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only author can update content, team members can resolve
    if (dto.content !== undefined && comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit comment content');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: dto,
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

    // Track resolution
    if (dto.resolved !== undefined) {
      await this.monitoringService.trackUserActivity(userId, 'comment.resolved', {
        commentId,
        resolved: dto.resolved,
      });
    }

    return updated;
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete a comment');
    }

    // Delete comment and all replies (cascade)
    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    this.logger.log(`Comment ${commentId} deleted`);
  }

  // Review Management

  /**
   * Request review for specification
   */
  async requestReview(
    specificationId: string,
    requesterId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    // Verify specification exists and requester has access
    const specification = await this.getSpecificationWithAccess(specificationId, requesterId);

    // Check if reviewer is valid
    const reviewer = await this.prisma.user.findUnique({
      where: { id: dto.reviewerId },
    });

    if (!reviewer) {
      throw new NotFoundException('Reviewer not found');
    }

    // Check if review already exists
    const existingReview = await this.prisma.review.findFirst({
      where: {
        specificationId,
        reviewerId: dto.reviewerId,
        status: ReviewStatus.PENDING,
      },
    });

    if (existingReview) {
      throw new BadRequestException('Review already requested from this user');
    }

    // Create review request
    const review = await this.prisma.review.create({
      data: {
        specificationId,
        reviewerId: dto.reviewerId,
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
      },
    });

    // Send notification
    await this.notificationService.sendNotification(
      dto.reviewerId,
      NotificationType.REVIEW_REQUESTED,
      {
        title: `Review requested for "${specification.title}"`,
        content: dto.message || `Please review the specification "${specification.title}"`,
        metadata: {
          specificationId,
          requesterId,
          dueDate: dto.dueDate,
        },
      },
    );

    // Track activity
    await this.monitoringService.trackUserActivity(requesterId, 'review.requested', {
      specificationId,
      reviewerId: dto.reviewerId,
    });

    this.logger.log(`Review requested for specification ${specificationId}`);

    return review;
  }

  /**
   * Submit review decision
   */
  async submitReview(
    reviewId: string,
    reviewerId: string,
    dto: SubmitReviewDto,
  ): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        specification: {
          include: {
            author: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException('You are not assigned to this review');
    }

    if (review.status !== ReviewStatus.PENDING) {
      throw new BadRequestException('Review has already been submitted');
    }

    // Update review
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: dto.status,
        feedback: dto.feedback,
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
      },
    });

    // Update specification status if needed
    if (dto.status === ReviewStatus.APPROVED) {
      await this.prisma.specification.update({
        where: { id: review.specificationId },
        data: { status: 'APPROVED' },
      });
    } else if (dto.status === ReviewStatus.REJECTED) {
      await this.prisma.specification.update({
        where: { id: review.specificationId },
        data: { status: 'REJECTED' },
      });
    }

    // Send notification to author
    await this.notificationService.sendNotification(
      review.specification.authorId,
      NotificationType.REVIEW_COMPLETED,
      {
        title: `Review completed for "${review.specification.title}"`,
        content: `Your specification has been ${dto.status.toLowerCase()}`,
        metadata: {
          specificationId: review.specificationId,
          reviewerId,
          status: dto.status,
        },
      },
    );

    // Track activity
    await this.monitoringService.trackUserActivity(reviewerId, 'review.submitted', {
      reviewId,
      status: dto.status,
    });

    return updated;
  }

  /**
   * Get reviews for specification
   */
  async getReviews(
    specificationId: string,
    userId: string,
  ): Promise<Review[]> {
    // Verify access
    await this.getSpecificationWithAccess(specificationId, userId);

    const reviews = await this.prisma.review.findMany({
      where: { specificationId },
      include: {
        reviewer: {
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

    return reviews;
  }

  /**
   * Get pending reviews for user
   */
  async getPendingReviews(userId: string): Promise<Review[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        reviewerId: userId,
        status: ReviewStatus.PENDING,
      },
      include: {
        specification: {
          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews;
  }

  // Collaboration Statistics

  /**
   * Get collaboration statistics for specification
   */
  async getCollaborationStats(
    specificationId: string,
    userId: string,
  ): Promise<CollaborationStats> {
    // Verify access
    await this.getSpecificationWithAccess(specificationId, userId);

    const [
      totalComments,
      unresolvedComments,
      totalReviews,
      pendingReviews,
      collaborators,
      lastActivity,
    ] = await Promise.all([
      this.prisma.comment.count({ where: { specificationId } }),
      this.prisma.comment.count({ where: { specificationId, resolved: false } }),
      this.prisma.review.count({ where: { specificationId } }),
      this.prisma.review.count({ where: { specificationId, status: ReviewStatus.PENDING } }),
      this.prisma.comment.groupBy({
        by: ['authorId'],
        where: { specificationId },
      }),
      this.getLastActivity(specificationId),
    ]);

    return {
      totalComments,
      unresolvedComments,
      totalReviews,
      pendingReviews,
      activeCollaborators: collaborators.length,
      lastActivity,
    };
  }

  /**
   * Get collaboration activity timeline
   */
  async getActivityTimeline(
    specificationId: string,
    userId: string,
    limit: number = 20,
  ): Promise<CollaborationActivity[]> {
    // Verify access
    await this.getSpecificationWithAccess(specificationId, userId);

    // Get recent comments
    const comments = await this.prisma.comment.findMany({
      where: { specificationId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get recent reviews
    const reviews = await this.prisma.review.findMany({
      where: { specificationId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Combine and sort activities
    const activities: CollaborationActivity[] = [
      ...comments.map(comment => ({
        id: comment.id,
        type: 'comment' as const,
        userId: comment.authorId,
        userName: comment.author.name || 'Unknown',
        userAvatar: comment.author.avatar,
        specificationId,
        timestamp: comment.createdAt,
        data: {
          content: comment.content,
          section: comment.section,
          resolved: comment.resolved,
        },
      })),
      ...reviews.map(review => ({
        id: review.id,
        type: 'review' as const,
        userId: review.reviewerId,
        userName: review.reviewer.name || 'Unknown',
        userAvatar: review.reviewer.avatar,
        specificationId,
        timestamp: review.updatedAt,
        data: {
          status: review.status,
          feedback: review.feedback,
        },
      })),
    ];

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, limit);
  }

  // Private helper methods

  private async getSpecificationWithAccess(specificationId: string, userId: string) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
      include: {
        author: true,
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    // Check access
    const hasAccess =
      specification.authorId === userId ||
      (specification.team && specification.team.members.length > 0);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this specification');
    }

    return specification;
  }

  private async buildCommentThread(comment: any): Promise<CommentThread> {
    const replies = await this.prisma.comment.findMany({
      where: { parentId: comment.id },
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
    });

    const threadReplies = await Promise.all(
      replies.map(reply => this.buildCommentThread(reply)),
    );

    return {
      comment: {
        ...comment,
        replies: threadReplies.map(t => t.comment),
      },
    };
  }

  private async notifyCommentAdded(specification: any, comment: any) {
    // Notify specification author (if not the commenter)
    if (specification.authorId !== comment.authorId) {
      await this.notificationService.sendNotification(
        specification.authorId,
        NotificationType.COMMENT_ADDED,
        {
          title: `New comment on "${specification.title}"`,
          content: comment.content.substring(0, 100),
          metadata: {
            specificationId: specification.id,
            commentId: comment.id,
            authorName: comment.author.name,
          },
        },
      );
    }

    // Notify team members if it's a team specification
    if (specification.teamId) {
      await this.notificationService.sendTeamNotification(
        specification.teamId,
        NotificationType.COMMENT_ADDED,
        {
          title: `New comment on "${specification.title}"`,
          content: `${comment.author.name} commented: ${comment.content.substring(0, 100)}`,
          metadata: {
            specificationId: specification.id,
            commentId: comment.id,
          },
          excludeUserId: comment.authorId,
        },
      );
    }
  }

  private async getLastActivity(specificationId: string): Promise<Date | undefined> {
    const [lastComment, lastReview] = await Promise.all([
      this.prisma.comment.findFirst({
        where: { specificationId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.review.findFirst({
        where: { specificationId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const dates = [
      lastComment?.createdAt,
      lastReview?.updatedAt,
    ].filter(Boolean) as Date[];

    if (dates.length === 0) return undefined;

    return new Date(Math.max(...dates.map(d => d.getTime())));
  }
}

// ============================================