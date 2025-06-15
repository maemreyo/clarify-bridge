//  Sequence diagram generator

import { Injectable } from '@nestjs/common';

interface SequenceParticipant {
  id: string;
  name: string;
  type?: 'actor' | 'participant' | 'database';
}

interface SequenceMessage {
  from: string;
  to: string;
  message: string;
  type?: 'sync' | 'async' | 'return' | 'note';
  notePosition?: 'left of' | 'right of' | 'over';
}

@Injectable()
export class SequenceGenerator {
  generateSequenceDiagram(
    participants: SequenceParticipant[],
    messages: SequenceMessage[],
  ): string {
    let mermaid = 'sequenceDiagram\n';

    // Add participants
    participants.forEach(p => {
      const prefix = p.type === 'actor' ? 'actor' : 'participant';
      mermaid += `    ${prefix} ${p.id} as ${p.name}\n`;
    });

    mermaid += '\n';

    // Add messages
    messages.forEach(msg => {
      if (msg.type === 'note') {
        mermaid += `    Note ${msg.notePosition || 'over'} ${msg.from}: ${msg.message}\n`;
      } else {
        const arrow = this.getArrowType(msg.type);
        mermaid += `    ${msg.from}${arrow}${msg.to}: ${msg.message}\n`;
      }
    });

    return mermaid;
  }

  generateFromEndpoints(
    endpoints: Array<{
      method: string;
      path: string;
      description: string;
      authentication: boolean;
    }>,
  ): string {
    const participants: SequenceParticipant[] = [
      { id: 'User', name: 'User', type: 'actor' },
      { id: 'Frontend', name: 'Frontend App', type: 'participant' },
      { id: 'API', name: 'Backend API', type: 'participant' },
      { id: 'DB', name: 'Database', type: 'database' },
    ];

    const messages: SequenceMessage[] = [];

    endpoints.forEach((endpoint, index) => {
      // User initiates
      messages.push({
        from: 'User',
        to: 'Frontend',
        message: `${endpoint.description}`,
      });

      // Frontend to API
      messages.push({
        from: 'Frontend',
        to: 'API',
        message: `${endpoint.method} ${endpoint.path}`,
      });

      // Authentication check if needed
      if (endpoint.authentication) {
        messages.push({
          from: 'API',
          to: 'API',
          message: 'Verify JWT Token',
          type: 'note',
          notePosition: 'right of',
        });
      }

      // API to Database
      messages.push({
        from: 'API',
        to: 'DB',
        message: 'Query/Update Data',
      });

      messages.push({
        from: 'DB',
        to: 'API',
        message: 'Return Data',
        type: 'return',
      });

      // API to Frontend
      messages.push({
        from: 'API',
        to: 'Frontend',
        message: 'Response (200 OK)',
        type: 'return',
      });

      // Frontend to User
      messages.push({
        from: 'Frontend',
        to: 'User',
        message: 'Display Result',
        type: 'return',
      });

      // Add spacing between flows
      if (index < endpoints.length - 1) {
        messages.push({
          from: 'User',
          to: 'User',
          message: ' ',
          type: 'note',
        });
      }
    });

    return this.generateSequenceDiagram(participants, messages);
  }

  private getArrowType(type?: string): string {
    switch (type) {
      case 'async':
        return '->>';
      case 'return':
        return '-->';
      default:
        return '->';
    }
  }
}

// ============================================
