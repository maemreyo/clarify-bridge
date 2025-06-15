// Updated: Health check controller with comprehensive system checks

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@core/auth/decorators/public.decorator';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { LlmHealthIndicator } from './indicators/llm.health';
import { VectorDbHealthIndicator } from './indicators/vector-db.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private database: DatabaseHealthIndicator,
    private redis: RedisHealthIndicator,
    private llm: LlmHealthIndicator,
    private vectorDb: VectorDbHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  check() {
    return this.health.check([
      // Database check
      () => this.database.isHealthy('database'),

      // Redis check
      () => this.redis.isHealthy('redis'),

      // Memory check (heap used < 200MB)
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),

      // Memory RSS check (< 300MB)
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  readiness() {
    return this.health.check([
      // All critical services must be ready
      () => this.database.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('detailed')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Detailed health check with all services' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  detailed() {
    return this.health.check([
      // Core services
      () => this.database.isHealthy('database'),
      () => this.redis.isHealthy('redis'),

      // AI services
      () => this.llm.isHealthy('llm'),
      () => this.vectorDb.isHealthy('vector_db'),

      // System resources
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.disk.checkStorage('disk_storage', {
        path: process.platform === 'win32' ? 'C:\\' : '/',
        thresholdPercent: 0.9, // 90% threshold
      }),

      // External dependencies (if needed)
      () => this.http.pingCheck('google', 'https://google.com'),
    ]);
  }

  @Get('metrics')
  @Public()
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({ status: 200, description: 'System metrics' })
  async metrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      uptime: {
        seconds: uptime,
        formatted: this.formatUptime(uptime),
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: process.cpuUsage(),
      node: {
        version: process.version,
        env: process.env.NODE_ENV,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }
}

// ============================================