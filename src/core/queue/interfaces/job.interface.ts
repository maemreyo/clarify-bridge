//  Job-related interfaces

export interface BaseJobPayload {
  timestamp: Date;
  correlationId?: string;
}

export interface SpecificationGenerationPayload extends BaseJobPayload {
  title: string;
  description: string;
  context: {
    rawInput: string;
    processedContext?: any;
    attachments?: string[];
  };
  requirements: {
    functional: string[];
    nonFunctional: string[];
    constraints?: string[];
  };
  options?: {
    generateDiagrams: boolean;
    performQualityCheck: boolean;
    notifyOnComplete: boolean;
  };
}

export interface NotificationPayload extends BaseJobPayload {
  recipients: string[];
  channel: 'email' | 'in-app' | 'webhook';
  template: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface AnalyticsPayload extends BaseJobPayload {
  eventName: string;
  properties: Record<string, any>;
  userProperties?: Record<string, any>;
}

// ============================================
