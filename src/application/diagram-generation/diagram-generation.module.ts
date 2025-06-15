// Updated: Diagram generation module configuration

import { Module } from '@nestjs/common';
import { DiagramGenerationService } from './diagram-generation.service';
import { FlowchartGenerator } from './generators/flowchart.generator';
import { SequenceGenerator } from './generators/sequence.generator';
import { EntityRelationshipGenerator } from './generators/entity-relationship.generator';

@Module({
  providers: [
    DiagramGenerationService,
    FlowchartGenerator,
    SequenceGenerator,
    EntityRelationshipGenerator,
  ],
  exports: [DiagramGenerationService],
})
export class DiagramGenerationModule {}

// ============================================