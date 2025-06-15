// Updated: Collaboration DTOs

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ description: 'Section of specification (pm_view, frontend_view, backend_view)' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for replies' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiPropertyOptional({ description: 'Updated comment content' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({ description: 'Mark comment as resolved' })
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;
}

export class CreateReviewDto {
  @ApiProperty({ description: 'Reviewer user ID' })
  @IsUUID()
  reviewerId: string;

  @ApiPropertyOptional({ description: 'Review request message' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({ description: 'Due date for review' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class SubmitReviewDto {
  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;

  @ApiProperty({ description: 'Review feedback' })
  @IsString()
  @MaxLength(5000)
  feedback: string;
}

export class CommentFilterDto {
  @ApiPropertyOptional({ description: 'Filter by section' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ description: 'Filter by resolved status' })
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;

  @ApiPropertyOptional({ description: 'Include replies in response' })
  @IsOptional()
  @IsBoolean()
  includeReplies?: boolean = true;
}

// Response DTOs

export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  section?: string;

  @ApiProperty()
  resolved: boolean;

  @ApiProperty()
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };

  @ApiPropertyOptional()
  parentId?: string;

  @ApiPropertyOptional({ type: [CommentResponseDto] })
  replies?: CommentResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiPropertyOptional()
  feedback?: string;

  @ApiProperty()
  reviewer: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };

  @ApiProperty()
  specification: {
    id: string;
    title: string;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================