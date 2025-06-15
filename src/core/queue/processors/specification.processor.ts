// Updated: Specification job processor

import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { QueueName, JobType, JobData, JobResult } from '../job-queue.service';
import { PrismaService } from '@core/database';
import { LlmCoreService } from '@core/llm';
import { SpecificationStatus } from '@prisma/client';

// Note: In real implementation, these services would be imported from application layer
// For now, we'll inject them dynamically when the application layer is ready
interface ISpecificationService {
  generateSpecification(data: any): Promise<any>;
  updateSpecification(id: string, data: any): Promise<any>;
  performQualityCheck(id: string): Promise<any>;
}

interface INotificationService {
  sendNotification(userId: string, type: string, data: any): Promise<void>;
}

@Processor(QueueName.SPECIFICATION)
export class SpecificationProcessor {
  private readonly logger = new Logger(SpecificationProcessor.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmCoreService,
    @Inject(forwardRef(() => 'SpecificationService'))
    private specificationService: ISpecificationService,
    @Inject(forwardRef(() => 'NotificationService'))
    private notificationService: INotificationService,
  ) {}

  @Process(JobType.GENERATE_SPECIFICATION)
  async handleGenerateSpecification(job: Job<JobData>): Promise<JobResult> {
    this.logger.log(`Processing specification generation job ${job.id}`);

    try {
      const { payload, userId, teamId } = job.data;

      // Update progress
      await job.progress(10);

      // Create initial specification record
      const specification = await this.prisma.specification.create({
        data: {
          title: payload.title,
          description: payload.description,
          status: SpecificationStatus.DRAFT,
          authorId: userId!,
          teamId,
        },
      });

      await job.progress(20);

      // Generate specification content
      const result = await this.specificationService.generateSpecification({
        specificationId: specification.id,
        context: payload.context,
        requirements: payload.requirements,
      });

      await job.progress(80);

      // Update specification status
      await this.prisma.specification.update({
        where: { id: specification.id },
        data: {
          status: SpecificationStatus.IN_REVIEW,
          qualityScore: result.qualityScore,
        },
      });

      await job.progress(90);

      // Send notification
      await this.notificationService.sendNotification(
        userId!,
        'SPEC_COMPLETED',
        {
          specificationId: specification.id,
          title: specification.title,
        },
      );

      await job.progress(100);

      return {
        success: true,
        data: {
          specificationId: specification.id,
          qualityScore: result.qualityScore,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to process specification generation job ${job.id}`,
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Process(JobType.UPDATE_SPECIFICATION)
  async handleUpdateSpecification(job: Job<JobData>): Promise<JobResult> {
    this.logger.log(`Processing specification update job ${job.id}`);

    try {
      const { payload } = job.data;

      const result = await this.specificationService.updateSpecification(
        payload.specificationId,
        payload.updates,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process specification update job ${job.id}`,
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Process(JobType.QUALITY_CHECK)
  async handleQualityCheck(job: Job<JobData>): Promise<JobResult> {
    this.logger.log(`Processing quality check job ${job.id}`);

    try {
      const { payload, userId } = job.data;

      // Perform quality check
      const qualityResult = await this.specificationService.performQualityCheck(
        payload.specificationId,
      );

      // Update specification with quality metrics
      await this.prisma.specification.update({
        where: { id: payload.specificationId },
        data: {
          qualityScore: qualityResult.overallScore,
          lastReviewedAt: new Date(),
        },
      });

      // Store detailed quality metrics
      await this.prisma.qualityMetrics.create({
        data: {
          specificationId: payload.specificationId,
          aiSelfScore: qualityResult.aiSelfScore,
          consistencyScore: qualityResult.consistencyScore,
          completenessScore: qualityResult.completenessScore,
        },
      });

      // Send notification if quality is below threshold
      if (qualityResult.overallScore < 0.7) {
        await this.notificationService.sendNotification(
          userId!,
          'QUALITY_ALERT',
          {
            specificationId: payload.specificationId,
            score: qualityResult.overallScore,
            issues: qualityResult.issues,
          },
        );
      }

      return {
        success: true,
        data: qualityResult,
      };
    } catch (error) {
      this.logger.error(`Failed to process quality check job ${job.id}`, error);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Global error handler for the processor
   */
  @Process('failed')
  async handleFailedJob(job: Job<JobData>): Promise<void> {
    this.logger.error(
      `Job ${job.id} of type ${job.data.type} failed after ${job.attemptsMade} attempts`,
      job.failedReason,
    );

    // Track failed job in analytics
    await this.prisma.analyticsEvent.create({
      data: {
        eventType: 'job_failed',
        eventData: {
          jobId: job.id,
          jobType: job.data.type,
          attempts: job.attemptsMade,
          error: job.failedReason,
        },
        userId: job.data.userId,
        teamId: job.data.teamId,
      },
    });
  }
}

// ============================================