//  Team DTOs implementation

import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsUUID,
  IsUrl,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { TeamRole } from '@prisma/client';

export class CreateTeamDto {
  @ApiProperty({ example: 'Engineering Team', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'engineering-team', description: 'URL-friendly team identifier' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Transform(({ value }) => value?.toLowerCase().trim())
  slug: string;

  @ApiPropertyOptional({ example: 'Main engineering team for product development' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  avatar?: string;
}

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: 'Updated Team Name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: 'Updated team description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/new-avatar.png' })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({ description: 'Team settings JSON object' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class InviteUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ enum: TeamRole, example: TeamRole.MEMBER })
  @IsEnum(TeamRole)
  role: TeamRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: TeamRole, example: TeamRole.ADMIN })
  @IsEnum(TeamRole)
  role: TeamRole;
}

export class TeamResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty()
  owner: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };

  @ApiProperty()
  membersCount: number;

  @ApiProperty()
  usageQuota: number;

  @ApiProperty()
  usageCount: number;

  @ApiPropertyOptional()
  settings?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TeamMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: TeamRole })
  role: TeamRole;

  @ApiProperty()
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };

  @ApiProperty()
  joinedAt: Date;
}

export class TeamWithMembersDto extends TeamResponseDto {
  @ApiProperty({ type: [TeamMemberDto] })
  members: TeamMemberDto[];
}

// ============================================
