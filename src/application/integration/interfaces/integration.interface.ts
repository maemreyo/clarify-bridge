//  Integration interfaces and types

export enum IntegrationType {
  JIRA = 'JIRA',
  LINEAR = 'LINEAR',
  NOTION = 'NOTION',
  GITHUB = 'GITHUB',
  SLACK = 'SLACK',
}

export enum IntegrationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  SYNCING = 'SYNCING',
}

export interface IntegrationConfig {
  // Common fields
  name: string;
  description?: string;
  webhookSecret?: string;

  // Provider-specific fields
  [key: string]: any;
}

export interface JiraConfig extends IntegrationConfig {
  domain: string; // e.g., "company.atlassian.net"
  email: string;
  apiKey: string;
  projectKey: string;
  issueTypeId?: string;
}

export interface LinearConfig extends IntegrationConfig {
  apiKey: string;
  teamId: string;
  projectId?: string;
  defaultStateId?: string;
}

export interface NotionConfig extends IntegrationConfig {
  apiKey: string;
  databaseId: string;
  workspaceId?: string;
}

export interface GitHubConfig extends IntegrationConfig {
  accessToken: string;
  owner: string; // GitHub username or org
  repo: string;
  defaultLabels?: string[];
}

export interface SlackConfig extends IntegrationConfig {
  webhookUrl?: string; // For incoming webhooks
  appToken?: string; // For Slack app
  channelId: string;
  botUserId?: string;
}

export interface SyncResult {
  jobId?: string;
  status: 'success' | 'partial' | 'failed' | 'queued';
  message: string;
  syncedItems?: number;
  errors?: string[];
}

export interface WebhookEvent {
  id: string;
  integrationId: string;
  event: string;
  payload: any;
  status: 'pending' | 'processed' | 'failed';
  error?: string;
  createdAt: Date;
}

export interface ExportResult {
  externalId: string;
  externalUrl: string;
  provider: IntegrationType;
  createdAt: Date;
}

// Provider interface that all integration providers must implement
export interface IntegrationProvider {
  readonly type: IntegrationType;

  validateConfig(config: IntegrationConfig): Promise<boolean>;

  testConnection(config: IntegrationConfig): Promise<boolean>;

  sync(integration: any): Promise<SyncResult>;

  exportSpecification(specification: any, config: IntegrationConfig): Promise<ExportResult>;

  processWebhook(integration: any, event: string, payload: any): Promise<void>;
}

// ============================================
