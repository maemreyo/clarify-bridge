//  ER diagram generator

import { Injectable } from '@nestjs/common';

interface EREntity {
  name: string;
  attributes: Array<{
    name: string;
    type: string;
    key?: 'PK' | 'FK';
    required?: boolean;
  }>;
}

interface ERRelationship {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  label?: string;
}

@Injectable()
export class EntityRelationshipGenerator {
  generateERDiagram(entities: EREntity[], relationships: ERRelationship[]): string {
    let mermaid = 'erDiagram\n';

    // Add entities
    entities.forEach(entity => {
      mermaid += `    ${this.sanitizeName(entity.name)} {\n`;

      entity.attributes.forEach(attr => {
        const type = this.mapDataType(attr.type);
        const key = attr.key ? ` ${attr.key}` : '';
        const nullable = attr.required === false ? ' "nullable"' : '';
        mermaid += `        ${type} ${this.sanitizeName(attr.name)}${key}${nullable}\n`;
      });

      mermaid += '    }\n\n';
    });

    // Add relationships
    relationships.forEach(rel => {
      const notation = this.getRelationshipNotation(rel.type);
      const label = rel.label ? ` : "${rel.label}"` : '';
      mermaid += `    ${this.sanitizeName(rel.from)} ${notation} ${this.sanitizeName(rel.to)}${label}\n`;
    });

    return mermaid;
  }

  generateFromDataModels(
    dataModels: Array<{
      name: string;
      description: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }>;
      relationships?: string[];
    }>,
  ): string {
    const entities: EREntity[] = dataModels.map(model => ({
      name: model.name,
      attributes: model.fields.map((field, index) => ({
        name: field.name,
        type: field.type,
        key: index === 0 ? ('PK' as const) : undefined, // Assume first field is PK
        required: field.required,
      })),
    }));

    const relationships: ERRelationship[] = [];

    // Parse relationships from strings
    dataModels.forEach(model => {
      if (model.relationships) {
        model.relationships.forEach(rel => {
          const match = rel.match(/(\w+):\s*(\w+)/);
          if (match) {
            const [, relType, targetModel] = match;
            relationships.push({
              from: model.name,
              to: targetModel,
              type: this.parseRelationType(relType),
              label: relType,
            });
          }
        });
      }
    });

    return this.generateERDiagram(entities, relationships);
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private mapDataType(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      text: 'text',
      number: 'int',
      integer: 'int',
      float: 'float',
      double: 'double',
      boolean: 'boolean',
      bool: 'boolean',
      date: 'date',
      datetime: 'datetime',
      timestamp: 'timestamp',
      json: 'json',
      array: 'array',
    };

    return typeMap[type.toLowerCase()] || 'string';
  }

  private getRelationshipNotation(type: string): string {
    switch (type) {
      case 'one-to-one':
        return '||--||';
      case 'one-to-many':
        return '||--o{';
      case 'many-to-many':
        return '}o--o{';
      default:
        return '||--||';
    }
  }

  private parseRelationType(relType: string): 'one-to-one' | 'one-to-many' | 'many-to-many' {
    const lower = relType.toLowerCase();
    if (lower.includes('many')) {
      return lower.includes('tomany') ? 'many-to-many' : 'one-to-many';
    }
    return 'one-to-one';
  }
}

// ============================================
