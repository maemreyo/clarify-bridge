// Updated: Monitoring interfaces

export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface LogContext {
  userId?: string;
  teamId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface BusinessMetric {
  metric: string;
  value: number;
  dimensions?: Record<string, string>;
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

// ============================================