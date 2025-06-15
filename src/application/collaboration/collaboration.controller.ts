// Updated: Collaboration API endpoints

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CollaborationService } from './collaboration.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CreateReviewDto,
  SubmitReviewDto,
  CommentFilterDto,
  CommentResponseDto,
  ReviewResponseDto,
} from './dto/collaboration.dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';

@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('specifications/:specificationId/collaboration')
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  // Comment endpoints

  @Post('comments')
  @ApiOperation({ summary: 'Add comment to specification' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiResponse({ status: 201, description: 'Comment added', type: CommentResponseDto })
  async addComment(
    @Param('specificationId') specificationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.collaborationService.addComment(specificationId, userId, dto);
  }

  @Get('comments')
  @ApiOperation({ summary: 'Get comments for specification' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'Comments retrieved', type: [CommentResponseDto] })
  async getComments(
    @Param('specificationId') specificationId: string,
    @CurrentUser('id') userId: string,
    @Query() filter: CommentFilterDto,
  ) {
    return this.collaborationService.getComments(specificationId, userId, filter);
  }

  @Put('comments/:commentId')
  @ApiOperation({ summary: 'Update comment' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment updated', type: CommentResponseDto })
  async updateComment(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.collaborationService.updateComment(commentId, userId, dto);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete comment' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  async deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.collaborationService.deleteComment(commentId, userId);
  }

  // Review endpoints

  @Post('reviews')
  @ApiOperation({ summary: 'Request review for specification' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiResponse({ status: 201, description: 'Review requested', type: ReviewResponseDto })
  async requestReview(
    @Param('specificationId') specificationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.collaborationService.requestReview(specificationId, userId, dto);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Get reviews for specification' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved', type: [ReviewResponseDto] })
  async getReviews(
    @Param('specificationId') specificationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.collaborationService.getReviews(specificationId, userId);
  }

  @Put('reviews/:reviewId')
  @ApiOperation({ summary: 'Submit review decision' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiParam({ name: 'reviewId', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Review submitted', type: ReviewResponseDto })
  async submitReview(
    @Param('reviewId') reviewId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.collaborationService.submitReview(reviewId, userId, dto);
  }

  // Collaboration statistics

  @Get('stats')
  @ApiOperation({ summary: 'Get collaboration statistics' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(
    @Param('specificationId') specificationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.collaborationService.getCollaborationStats(specificationId, userId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get collaboration activity timeline' })
  @ApiParam({ name: 'specificationId', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'Activity timeline retrieved' })
  async getActivity(
    @Param('specificationId') specificationId: string,
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.collaborationService.getActivityTimeline(
      specificationId,
      userId,
      limit ? parseInt(limit.toString()) : 20,
    );
  }
}

// Additional endpoint for user's pending reviews
@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews/pending')
export class UserReviewController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get()
  @ApiOperation({ summary: 'Get pending reviews for current user' })
  @ApiResponse({ status: 200, description: 'Pending reviews retrieved', type: [ReviewResponseDto] })
  async getPendingReviews(@CurrentUser('id') userId: string) {
    return this.collaborationService.getPendingReviews(userId);
  }
}

// ============================================