//  Job Queue service implementation

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions } from 'bull';

export enum QueueName {
  SPECIFICATION = 'specification',
  NOTIFICATION = 'notification',
  ANALYTICS = 'analytics',
}

export enum JobType {
  // Specification jobs
  GENERATE_SPECIFICATION = 'generate_specification',
  UPDATE_SPECIFICATION = 'update_specification',
  QUALITY_CHECK = 'quality_check',

  // Notification jobs
  SEND_EMAIL = 'send_email',
  SEND_WEBHOOK = 'send_webhook',
  SEND_IN_APP = 'send_in_app',

  // Analytics jobs
  TRACK_EVENT = 'track_event',
  GENERATE_REPORT = 'generate_report',
}

export interface JobData {
  type: JobType;
  payload: any;
  userId?: string;
  teamId?: string;
  metadata?: Record<string, any>;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectQueue(QueueName.SPECIFICATION) private specificationQueue: Queue<JobData>,
    @InjectQueue(QueueName.NOTIFICATION) private notificationQueue: Queue<JobData>,
    @InjectQueue(QueueName.ANALYTICS) private analyticsQueue: Queue<JobData>,
  ) {}

  /**
   * Add a job to the appropriate queue
   */
  async addJob(queueName: QueueName, data: JobData, options?: JobOptions): Promise<Job<JobData>> {
    const queue = this.getQueue(queueName);
    const defaultOptions: JobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds
      },
      removeOnComplete: true,
      removeOnFail: false,
    };

    const job = await queue.add(data.type, data, {
      ...defaultOptions,
      ...options,
    });

    this.logger.log(`Job ${job.id} of type ${data.type} added to ${queueName} queue`);

    return job;
  }

  /**
   * Add multiple jobs to a queue
   */
  async addBulkJobs(
    queueName: QueueName,
    jobs: Array<{ data: JobData; options?: JobOptions }>,
  ): Promise<Job<JobData>[]> {
    const queue = this.getQueue(queueName);
    const bulkJobs = jobs.map(({ data, options }) => ({
      name: data.type,
      data,
      opts: options,
    }));

    return queue.addBulk(bulkJobs);
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: QueueName, jobId: string): Promise<Job<JobData> | null> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: QueueName, jobId: string): Promise<string> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      return 'not_found';
    }

    const [isCompleted, isFailed, isDelayed, isActive, isWaiting, isPaused] = await Promise.all([
      job.isCompleted(),
      job.isFailed(),
      job.isDelayed(),
      job.isActive(),
      job.isWaiting(),
      job.isPaused(),
    ]);

    if (isCompleted) return 'completed';
    if (isFailed) return 'failed';
    if (isDelayed) return 'delayed';
    if (isActive) return 'active';
    if (isWaiting) return 'waiting';
    if (isPaused) return 'paused';

    return 'unknown';
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName) {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getPausedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + completed + failed + delayed + paused,
    };
  }

  /**
   * Clean old jobs from queue
   */
  async cleanQueue(
    queueName: QueueName,
    grace: number = 3600000, // 1 hour
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await Promise.all([queue.clean(grace, 'completed'), queue.clean(grace, 'failed')]);

    this.logger.log(`Cleaned old jobs from ${queueName} queue`);
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.log(`${queueName} queue paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`${queueName} queue resumed`);
  }

  /**
   * Get the appropriate queue by name
   */
  private getQueue(queueName: QueueName): Queue<JobData> {
    switch (queueName) {
      case QueueName.SPECIFICATION:
        return this.specificationQueue;
      case QueueName.NOTIFICATION:
        return this.notificationQueue;
      case QueueName.ANALYTICS:
        return this.analyticsQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }
}

// ============================================
