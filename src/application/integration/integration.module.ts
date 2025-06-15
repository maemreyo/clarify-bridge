//  Integration module for external tools and platforms

import { Module } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { JiraProvider } from './providers/jira.provider';
import { LinearProvider } from './providers/linear.provider';
import { NotionProvider } from './providers/notion.provider';
import { GitHubProvider } from './providers/github.provider';
import { SlackProvider } from './providers/slack.provider';

@Module({
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    JiraProvider,
    LinearProvider,
    NotionProvider,
    GitHubProvider,
    SlackProvider,
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}

// ============================================
