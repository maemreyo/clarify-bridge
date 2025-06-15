//  Core specification management service

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/database';
import { JobQueueService, QueueName, JobType } from '@core/queue';
import { NotificationService } from '@core/notification';
import { VectorDbService } from '@core/vector-db';
import { UsageService } from '@core/usage';
import { MonitoringService } from '@core/monitoring';
import { SpecificationStatus, Priority, Prisma, NotificationType } from '@prisma/client';
import {
  CreateSpecificationDto,
  UpdateSpecificationDto,
  UpdateSpecificationVersionDto,
  RegenerateViewDto,
  SpecificationFilterDto,
} from './dto/specification.dto';
import { SpecificationContext, GeneratedViews } from './interfaces/specification.interface';

@Injectable()
export class SpecificationService {
  private readonly logger = new Logger(SpecificationService.name);

  constructor(
    private prisma: PrismaService,
    private jobQueue: JobQueueService,
    private notificationService: NotificationService,
    private vectorDbService: VectorDbService,
    private usageService: UsageService,
    private monitoringService: MonitoringService,
  ) {}

  /**
   * Create a new specification
   */
  async createSpecification(userId: string, dto: CreateSpecificationDto) {
    // Track activity
    await this.monitoringService.trackUserActivity(userId, 'specification.create', {
      title: dto.title,
      teamId: dto.teamId,
    });

    // Create specification in database
    const specification = await this.prisma.specification.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority || Priority.MEDIUM,
        status: SpecificationStatus.DRAFT,
        authorId: userId,
        teamId: dto.teamId,
        externalLinks: dto.context?.references
          ? {
              references: dto.context.references,
            }
          : undefined,
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
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Prepare context for generation
    const context: SpecificationContext = {
      rawInput: dto.requirements,
      ...dto.context,
    };

    // Queue generation job
    const job = await this.jobQueue.addJob(
      QueueName.SPECIFICATION,
      {
        type: JobType.GENERATE_SPECIFICATION,
        payload: {
          specificationId: specification.id,
          title: dto.title,
          description: dto.description,
          context,
          requirements: {
            functional: [],
            nonFunctional: [],
          },
          options: dto.options,
        },
        userId,
        teamId: dto.teamId,
      },
      {
        priority: dto.priority === Priority.URGENT ? 1 : dto.priority === Priority.HIGH ? 2 : 3,
      },
    );

    this.logger.log(`Specification ${specification.id} created and queued for generation`);

    return {
      specification: this.formatSpecificationResponse(specification),
      generationStatus: {
        specificationId: specification.id,
        jobId: job.id as string,
        status: 'queued' as const,
      },
    };
  }

  /**
   * Get specification by ID
   */
  async getSpecification(specificationId: string, userId: string) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    // Check access permission
    if (!(await this.canAccessSpecification(specification, userId))) {
      throw new ForbiddenException('You do not have access to this specification');
    }

    // Track view
    await this.monitoringService.trackUserActivity(userId, 'specification.view', {
      specificationId,
    });

    return this.formatSpecificationResponse(specification);
  }

  /**
   * Get user's specifications
   */
  async getUserSpecifications(userId: string, filter: SpecificationFilterDto) {
    const where: Prisma.SpecificationWhereInput = {
      OR: [
        { authorId: userId },
        {
          team: {
            members: {
              some: { userId },
            },
          },
        },
      ],
    };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.priority) {
      where.priority = filter.priority;
    }

    if (filter.teamId) {
      where.teamId = filter.teamId;
    }

    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [specifications, total] = await Promise.all([
      this.prisma.specification.findMany({
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
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              versions: true,
              comments: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.specification.count({ where }),
    ]);

    return {
      specifications: specifications.map(spec => this.formatSpecificationResponse(spec)),
      total,
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  /**
   * Update specification
   */
  async updateSpecification(specificationId: string, userId: string, dto: UpdateSpecificationDto) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    if (!(await this.canEditSpecification(specification, userId))) {
      throw new ForbiddenException('You do not have permission to edit this specification');
    }

    const updated = await this.prisma.specification.update({
      where: { id: specificationId },
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
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
    });

    // Re-index if title or description changed
    if (dto.title || dto.description) {
      await this.vectorDbService.indexSpecification(specificationId);
    }

    this.logger.log(`Specification ${specificationId} updated`);

    return this.formatSpecificationResponse(updated);
  }

  /**
   * Update specification version
   */
  async updateSpecificationVersion(
    specificationId: string,
    userId: string,
    dto: UpdateSpecificationVersionDto,
  ) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    if (!(await this.canEditSpecification(specification, userId))) {
      throw new ForbiddenException('You do not have permission to edit this specification');
    }

    const currentVersion = specification.versions[0];
    if (!currentVersion) {
      throw new BadRequestException('No version found to update');
    }

    // Create new version
    const newVersion = await this.prisma.specificationVersion.create({
      data: {
        specificationId,
        version: currentVersion.version + 1,
        pmView: dto.pmView || currentVersion.pmView,
        frontendView: dto.frontendView || currentVersion.frontendView,
        backendView: dto.backendView || currentVersion.backendView,
        diagramSyntax: dto.diagramSyntax || currentVersion.diagramSyntax,
        changesSummary: dto.changesSummary,
        previousVersionId: currentVersion.id,
      },
    });

    // Update specification timestamp
    await this.prisma.specification.update({
      where: { id: specificationId },
      data: { updatedAt: new Date() },
    });

    // Re-index specification
    await this.vectorDbService.indexSpecification(specificationId);

    this.logger.log(`New version created for specification ${specificationId}`);

    return {
      id: newVersion.id,
      version: newVersion.version,
      changesSummary: newVersion.changesSummary,
    };
  }

  /**
   * Regenerate specific views
   */
  async regenerateViews(specificationId: string, userId: string, dto: RegenerateViewDto) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    if (!(await this.canEditSpecification(specification, userId))) {
      throw new ForbiddenException('You do not have permission to regenerate views');
    }

    // Queue regeneration job
    const job = await this.jobQueue.addJob(QueueName.SPECIFICATION, {
      type: JobType.UPDATE_SPECIFICATION,
      payload: {
        specificationId,
        updates: {
          view: dto.view,
          additionalContext: dto.additionalContext,
          improvements: dto.improvements,
        },
      },
      userId,
      teamId: specification.teamId,
    });

    return {
      specificationId,
      jobId: job.id as string,
      status: 'queued' as const,
      message: `Regeneration of ${dto.view} view(s) has been queued`,
    };
  }

  /**
   * Delete specification
   */
  async deleteSpecification(specificationId: string, userId: string) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    if (specification.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete a specification');
    }

    // Remove from vector DB
    await this.vectorDbService.removeSpecification(specificationId);

    // Delete specification (cascade deletes versions, comments, etc.)
    await this.prisma.specification.delete({
      where: { id: specificationId },
    });

    this.logger.log(`Specification ${specificationId} deleted`);
  }

  /**
   * Get specification versions
   */
  async getSpecificationVersions(specificationId: string, userId: string) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    if (!(await this.canAccessSpecification(specification, userId))) {
      throw new ForbiddenException('You do not have access to this specification');
    }

    const versions = await this.prisma.specificationVersion.findMany({
      where: { specificationId },
      orderBy: { version: 'desc' },
    });

    return versions.map(version => ({
      id: version.id,
      version: version.version,
      changesSummary: version.changesSummary,
      aiConfidenceScore: version.aiConfidenceScore,
      createdAt: version.createdAt,
    }));
  }

  /**
   * Get generation status
   */
  async getGenerationStatus(specificationId: string, jobId: string) {
    const job = await this.jobQueue.getJob(QueueName.SPECIFICATION, jobId);

    if (!job) {
      return {
        specificationId,
        jobId,
        status: 'not_found' as const,
      };
    }

    const status = await this.jobQueue.getJobStatus(QueueName.SPECIFICATION, jobId);
    const progress = job.progress();

    return {
      specificationId,
      jobId,
      status: status as any,
      progress: typeof progress === 'number' ? progress : undefined,
      message: job.failedReason,
    };
  }

  /**
   * Get related specifications
   */
  async getRelatedSpecifications(specificationId: string, userId: string) {
    const specification = await this.prisma.specification.findUnique({
      where: { id: specificationId },
    });

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    if (!(await this.canAccessSpecification(specification, userId))) {
      throw new ForbiddenException('You do not have access to this specification');
    }

    const related = await this.vectorDbService.getRelatedSpecifications(specificationId, {
      teamId: specification.teamId || undefined,
      limit: 5,
    });

    // Get specification details
    const specIds = related.map(r => r.id);
    const specifications = await this.prisma.specification.findMany({
      where: {
        id: { in: specIds },
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        author: {
          select: {
            name: true,
            avatar: true,
          },
        },
        createdAt: true,
      },
    });

    // Combine with scores
    return related.map(r => {
      const spec = specifications.find(s => s.id === r.id);
      return {
        ...spec,
        similarityScore: r.score,
      };
    });
  }

  // Private helper methods

  private async canAccessSpecification(specification: any, userId: string): Promise<boolean> {
    // Author always has access
    if (specification.authorId === userId) {
      return true;
    }

    // Team members have access
    if (specification.teamId) {
      const member = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: specification.teamId,
          },
        },
      });
      return !!member;
    }

    return false;
  }

  private async canEditSpecification(specification: any, userId: string): Promise<boolean> {
    // Author can always edit
    if (specification.authorId === userId) {
      return true;
    }

    // Team admins and owners can edit
    if (specification.teamId) {
      const member = await this.prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: specification.teamId,
          },
        },
      });
      return member && ['OWNER', 'ADMIN'].includes(member.role);
    }

    return false;
  }

  private formatSpecificationResponse(specification: any) {
    const latestVersion = specification.versions?.[0];

    return {
      id: specification.id,
      title: specification.title,
      description: specification.description,
      status: specification.status,
      priority: specification.priority,
      author: specification.author,
      team: specification.team,
      qualityScore: specification.qualityScore,
      lastReviewedAt: specification.lastReviewedAt,
      externalLinks: specification.externalLinks,
      latestVersion: latestVersion
        ? {
            id: latestVersion.id,
            version: latestVersion.version,
            pmView: latestVersion.pmView,
            frontendView: latestVersion.frontendView,
            backendView: latestVersion.backendView,
            diagramSyntax: latestVersion.diagramSyntax,
            aiConfidenceScore: latestVersion.aiConfidenceScore,
            validationResults: latestVersion.validationResults,
            changesSummary: latestVersion.changesSummary,
            createdAt: latestVersion.createdAt,
          }
        : undefined,
      versionsCount: specification._count?.versions || 0,
      commentsCount: specification._count?.comments || 0,
      createdAt: specification.createdAt,
      updatedAt: specification.updatedAt,
    };
  }

  /**
   * Internal method called by job processor to actually generate specification
   */
  async generateSpecification(data: {
    specificationId: string;
    context: SpecificationContext;
    requirements: any;
  }): Promise<any> {
    // This will be implemented when we create the other Application modules
    // For now, return a placeholder
    this.logger.log(`Generating specification ${data.specificationId}`);

    return {
      qualityScore: 0.85,
    };
  }

  /**
   * Internal method for updating specification
   */
  async updateSpecificationInternal(specificationId: string, updates: any): Promise<any> {
    // This will be implemented when we create the other Application modules
    this.logger.log(`Updating specification ${specificationId}`);

    return {};
  }

  /**
   * Internal method for quality check
   */
  async performQualityCheck(specificationId: string): Promise<any> {
    // This will be implemented with QualityAssuranceModule
    this.logger.log(`Performing quality check for ${specificationId}`);

    return {
      overallScore: 0.85,
      aiSelfScore: 0.9,
      consistencyScore: 0.8,
      completenessScore: 0.85,
      issues: [],
    };
  }
}

// ============================================
