// Updated: Usage DTOs

import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UsageAction } from '../interfaces/usage.interface';

export class TrackUsageDto {
  @ApiProperty({ enum: ['spec_generated', 'ai_generation', 'view_generated', 'vector_stored', 'vector_search', 'api_call', 'file_uploaded', 'team_member_added'] })
  @IsEnum(['spec_generated', 'ai_generation', 'view_generated', 'vector_stored', 'vector_search', 'api_call', 'file_uploaded', 'team_member_added'])
  action: UsageAction;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UsageStatsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ============================================