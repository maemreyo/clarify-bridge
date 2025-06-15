// Updated: Notification DTOs

import { IsString, IsEnum, IsOptional, IsObject, IsArray, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class SendNotificationDto {
  @ApiProperty({ description: 'User ID or email to send notification to' })
  @IsString()
  recipient: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SendEmailDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  template: string;

  @ApiProperty()
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  options?: {
    priority?: 'low' | 'normal' | 'high';
    attachments?: Array<{
      filename: string;
      content: string;
      contentType?: string;
    }>;
  };
}

// ============================================