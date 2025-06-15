// Updated: Flowchart diagram generator

import { Injectable } from '@nestjs/common';
import { DiagramOptions } from '../interfaces/diagram-generation.interface';

interface FlowchartNode {
  id: string;
  label: string;
  type?: 'start' | 'end' | 'process' | 'decision' | 'data';
}

interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  condition?: string;
}

@Injectable()
export class FlowchartGenerator {
  generateFlowchart(
    nodes: FlowchartNode[],
    edges: FlowchartEdge[],
    options: DiagramOptions = {},
  ): string {
    const direction = options.direction || 'TB';
    let mermaid = `flowchart ${direction}\n`;

    // Add nodes
    nodes.forEach(node => {
      const shape = this.getNodeShape(node.type);
      mermaid += `    ${node.id}${shape[0]}${this.escapeLabel(node.label)}${shape[1]}\n`;
    });

    mermaid += '\n';

    // Add edges
    edges.forEach(edge => {
      const arrow = edge.condition ? '-->|' + this.escapeLabel(edge.condition) + '|' : '-->';
      mermaid += `    ${edge.from} ${arrow} ${edge.to}\n`;
    });

    // Add styling if requested
    if (options.includeStyles) {
      mermaid += this.getDefaultStyles();
    }

    return mermaid;
  }

  generateFromUserStories(userStories: Array<{
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
  }>): string {
    const nodes: FlowchartNode[] = [
      { id: 'start', label: 'User Journey Start', type: 'start' },
    ];

    const edges: FlowchartEdge[] = [];
    let previousId = 'start';

    userStories.forEach((story, index) => {
      const nodeId = `story${index + 1}`;
      nodes.push({
        id: nodeId,
        label: story.title,
        type: 'process',
      });

      edges.push({
        from: previousId,
        to: nodeId,
      });

      previousId = nodeId;
    });

    nodes.push({ id: 'end', label: 'Journey Complete', type: 'end' });
    edges.push({ from: previousId, to: 'end' });

    return this.generateFlowchart(nodes, edges, { direction: 'TB' });
  }

  private getNodeShape(type?: string): [string, string] {
    switch (type) {
      case 'start':
      case 'end':
        return ['((', '))'];
      case 'decision':
        return ['{', '}'];
      case 'data':
        return ['[(', ')]'];
      default:
        return ['[', ']'];
    }
  }

  private escapeLabel(label: string): string {
    return label
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
  }

  private getDefaultStyles(): string {
    return `
    classDef startEnd fill:#90EE90,stroke:#333,stroke-width:2px
    classDef decision fill:#FFE4B5,stroke:#333,stroke-width:2px
    classDef process fill:#87CEEB,stroke:#333,stroke-width:2px

    class start,end startEnd
`;
  }
}

// ============================================