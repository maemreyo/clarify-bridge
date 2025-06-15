//  Integration DTOs

import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IntegrationType } from '../interfaces/integration.interface';

export class CreateIntegrationDto {
  @ApiProperty({ enum: IntegrationType, example: IntegrationType.JIRA })
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @ApiProperty({ description: 'Integration configuration object' })
  @IsObject()
  config: Record<string, any>;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ description: 'Updated configuration' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Enable or disable integration' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SyncIntegrationDto {
  @ApiPropertyOptional({
    description: 'Type of sync',
    example: 'full',
    default: 'incremental',
  })
  @IsOptional()
  @IsString()
  syncType?: 'full' | 'incremental' | 'manual' = 'incremental';
}

export class ProcessWebhookDto {
  @ApiProperty({ enum: IntegrationType })
  @IsEnum(IntegrationType)
  provider: IntegrationType;

  @ApiProperty({ description: 'Webhook event type' })
  @IsString()
  event: string;

  @ApiProperty({ description: 'Webhook payload' })
  @IsObject()
  payload: any;

  @ApiProperty({ description: 'Webhook secret for validation' })
  @IsString()
  secret: string;
}

export class ExportSpecificationDto {
  @ApiProperty({ description: 'Integration ID to export to' })
  @IsUUID()
  integrationId: string;

  @ApiPropertyOptional({ description: 'Export options' })
  @IsOptional()
  @IsObject()
  options?: {
    includeComments?: boolean;
    includeAttachments?: boolean;
    customFields?: Record<string, any>;
  };
}

// Response DTOs

export class IntegrationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: IntegrationType })
  type: IntegrationType;

  @ApiProperty()
  teamId: string;

  @ApiProperty({ description: 'Masked configuration' })
  config: Record<string, any>;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  lastSyncAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SyncResultDto {
  @ApiProperty()
  jobId?: string;

  @ApiProperty({ enum: ['success', 'partial', 'failed', 'queued'] })
  status: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  syncedItems?: number;

  @ApiPropertyOptional({ type: [String] })
  errors?: string[];
}

export class ExportResultDto {
  @ApiProperty()
  externalId: string;

  @ApiProperty()
  externalUrl: string;

  @ApiProperty({ enum: IntegrationType })
  provider: IntegrationType;

  @ApiProperty()
  createdAt: Date;
}

// ============================================
