//  Specification REST API endpoints

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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SpecificationService } from './specification.service';
import {
  CreateSpecificationDto,
  UpdateSpecificationDto,
  UpdateSpecificationVersionDto,
  RegenerateViewDto,
  SpecificationFilterDto,
  SpecificationResponseDto,
  SpecificationListResponseDto,
  GenerationStatusDto,
} from './dto/specification.dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { UsageGuard, CheckUsage } from '@core/usage/guards/usage.guard';
import { TeamMemberGuard } from '@core/team/guards/team-member.guard';

@ApiTags('Specifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('specifications')
export class SpecificationController {
  constructor(private readonly specificationService: SpecificationService) {}

  @Post()
  @UseGuards(UsageGuard)
  @CheckUsage('spec_generated')
  @ApiOperation({ summary: 'Create a new specification' })
  @ApiResponse({ status: 201, description: 'Specification created and queued for generation' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSpecificationDto,
    @Req() req: any,
  ) {
    const result = await this.specificationService.createSpecification(userId, dto);

    // Track usage after successful creation
    if (req.trackUsage) {
      await req.trackUsage();
    }

    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Get user specifications' })
  @ApiResponse({
    status: 200,
    description: 'Specifications retrieved',
    type: SpecificationListResponseDto,
  })
  async getUserSpecifications(
    @CurrentUser('id') userId: string,
    @Query() filter: SpecificationFilterDto,
  ): Promise<SpecificationListResponseDto> {
    return this.specificationService.getUserSpecifications(userId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specification by ID' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiResponse({
    status: 200,
    description: 'Specification retrieved',
    type: SpecificationResponseDto,
  })
  async getSpecification(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<SpecificationResponseDto> {
    return this.specificationService.getSpecification(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update specification' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiResponse({
    status: 200,
    description: 'Specification updated',
    type: SpecificationResponseDto,
  })
  async updateSpecification(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSpecificationDto,
  ): Promise<SpecificationResponseDto> {
    return this.specificationService.updateSpecification(id, userId, dto);
  }

  @Put(':id/version')
  @ApiOperation({ summary: 'Update specification version' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'New version created' })
  async updateVersion(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSpecificationVersionDto,
  ) {
    return this.specificationService.updateSpecificationVersion(id, userId, dto);
  }

  @Post(':id/regenerate')
  @UseGuards(UsageGuard)
  @CheckUsage('view_generated')
  @ApiOperation({ summary: 'Regenerate specification views' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'Regeneration queued' })
  async regenerateViews(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RegenerateViewDto,
    @Req() req: any,
  ) {
    const result = await this.specificationService.regenerateViews(id, userId, dto);

    if (req.trackUsage) {
      await req.trackUsage();
    }

    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete specification' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiResponse({ status: 204, description: 'Specification deleted' })
  async deleteSpecification(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.specificationService.deleteSpecification(id, userId);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get specification versions' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'Versions retrieved' })
  async getVersions(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.specificationService.getSpecificationVersions(id, userId);
  }

  @Get(':id/status/:jobId')
  @ApiOperation({ summary: 'Get generation status' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Generation status', type: GenerationStatusDto })
  async getGenerationStatus(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
  ): Promise<GenerationStatusDto> {
    return this.specificationService.getGenerationStatus(id, jobId);
  }

  @Get(':id/related')
  @ApiOperation({ summary: 'Get related specifications' })
  @ApiParam({ name: 'id', description: 'Specification ID' })
  @ApiResponse({ status: 200, description: 'Related specifications retrieved' })
  async getRelated(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.specificationService.getRelatedSpecifications(id, userId);
  }
}

// ============================================
