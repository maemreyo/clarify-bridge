// Updated: Specification DTOs for all operations

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsUUID,
  MinLength,
  MaxLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { SpecificationStatus, Priority } from '@prisma/client';

export class CreateSpecificationDto {
  @ApiProperty({ example: 'User Authentication System', minLength: 3, maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiPropertyOptional({ example: 'Build a secure authentication system with JWT' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: Priority, default: Priority.MEDIUM })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority = Priority.MEDIUM;

  @ApiPropertyOptional({ description: 'Team ID if creating for a team' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiProperty({ description: 'Main requirements and context' })
  @IsString()
  @MinLength(10)
  requirements: string;

  @ApiPropertyOptional({ description: 'Additional context or attachments' })
  @IsOptional()
  @IsObject()
  context?: {
    attachments?: string[];
    references?: string[];
    constraints?: string[];
    technicalStack?: string[];
  };

  @ApiPropertyOptional({ description: 'Generation options' })
  @IsOptional()
  @IsObject()
  options?: {
    generateDiagrams?: boolean;
    includeExamples?: boolean;
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  };
}

export class UpdateSpecificationDto {
  @ApiPropertyOptional({ example: 'Updated Title' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ enum: SpecificationStatus })
  @IsOptional()
  @IsEnum(SpecificationStatus)
  status?: SpecificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  externalLinks?: Record<string, any>;
}

export class UpdateSpecificationVersionDto {
  @ApiPropertyOptional({ description: 'Updated PM view content' })
  @IsOptional()
  @IsObject()
  pmView?: any;

  @ApiPropertyOptional({ description: 'Updated Frontend view content' })
  @IsOptional()
  @IsObject()
  frontendView?: any;

  @ApiPropertyOptional({ description: 'Updated Backend view content' })
  @IsOptional()
  @IsObject()
  backendView?: any;

  @ApiPropertyOptional({ description: 'Updated diagram syntax' })
  @IsOptional()
  @IsString()
  diagramSyntax?: string;

  @ApiPropertyOptional({ description: 'Changes summary for this version' })
  @IsOptional()
  @IsString()
  changesSummary?: string;
}

export class RegenerateViewDto {
  @ApiProperty({ enum: ['pm', 'frontend', 'backend', 'all'] })
  @IsEnum(['pm', 'frontend', 'backend', 'all'])
  view: 'pm' | 'frontend' | 'backend' | 'all';

  @ApiPropertyOptional({ description: 'Additional context for regeneration' })
  @IsOptional()
  @IsString()
  additionalContext?: string;

  @ApiPropertyOptional({ description: 'Specific improvements requested' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  improvements?: string[];
}

export class SpecificationFilterDto {
  @ApiPropertyOptional({ enum: SpecificationStatus })
  @IsOptional()
  @IsEnum(SpecificationStatus)
  status?: SpecificationStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  offset?: number = 0;
}

// Response DTOs

export class SpecificationVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  pmView: any;

  @ApiProperty()
  frontendView: any;

  @ApiProperty()
  backendView: any;

  @ApiPropertyOptional()
  diagramSyntax?: string;

  @ApiPropertyOptional()
  aiConfidenceScore?: number;

  @ApiPropertyOptional()
  validationResults?: any;

  @ApiPropertyOptional()
  changesSummary?: string;

  @ApiProperty()
  createdAt: Date;
}

export class SpecificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: SpecificationStatus })
  status: SpecificationStatus;

  @ApiProperty({ enum: Priority })
  priority: Priority;

  @ApiProperty()
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };

  @ApiPropertyOptional()
  team?: {
    id: string;
    name: string;
    slug: string;
  };

  @ApiPropertyOptional()
  qualityScore?: number;

  @ApiPropertyOptional()
  lastReviewedAt?: Date;

  @ApiPropertyOptional()
  externalLinks?: Record<string, any>;

  @ApiProperty()
  latestVersion?: SpecificationVersionResponseDto;

  @ApiProperty()
  versionsCount: number;

  @ApiProperty()
  commentsCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SpecificationListResponseDto {
  @ApiProperty({ type: [SpecificationResponseDto] })
  specifications: SpecificationResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

export class GenerationStatusDto {
  @ApiProperty()
  specificationId: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ enum: ['queued', 'processing', 'completed', 'failed'] })
  status: 'queued' | 'processing' | 'completed' | 'failed';

  @ApiPropertyOptional()
  progress?: number;

  @ApiPropertyOptional()
  message?: string;
}

// ============================================