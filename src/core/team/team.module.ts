// Updated: Team module configuration

import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { TeamMemberGuard } from './guards/team-member.guard';

@Module({
  controllers: [TeamController],
  providers: [TeamService, TeamMemberGuard],
  exports: [TeamService],
})
export class TeamModule {}

// ============================================