# Documentation Guide - The Clarity Bridge

## 📚 Overview

This guide explains how to properly document code in The Clarity Bridge project using JSDoc comments for TypeDoc generation.

## 🛠️ TypeDoc Setup

### Installation

```bash
# Install dependencies (already included in package.json)
pnpm install

# Generate documentation
pnpm docs:generate

# Watch mode for development
pnpm docs:watch

# Serve documentation locally
pnpm docs:serve
```

### Generated Documentation Location

- HTML Documentation: `docs/api/index.html`
- Markdown Documentation: `docs/api/README.md`

## 📝 Documentation Standards

### 1. Module Documentation

Every module should have a header comment:

```typescript
/**
 * @module TeamManagement
 * @category Core Services
 * @description Handles team creation, member management, and permissions
 */
```

### 2. Class Documentation

```typescript
/**
 * Service for managing team operations
 * 
 * This service provides functionality for:
 * - Creating and updating teams
 * - Managing team members
 * - Handling team permissions
 * 
 * @category Core Services
 * @since 1.0.0
 */
@Injectable()
export class TeamService {
  // ...
}
```

### 3. Method Documentation

```typescript
/**
 * Creates a new team
 * 
 * @param userId - ID of the user creating the team
 * @param dto - Team creation data
 * @returns The created team object
 * @throws {BadRequestException} If team slug already exists
 * @throws {UnauthorizedException} If user doesn't have permission
 * 
 * @example
 * ```typescript
 * const team = await teamService.createTeam('user-123', {
 *   name: 'Engineering Team',
 *   slug: 'engineering',
 *   description: 'Main engineering team'
 * });
 * ```
 */
async createTeam(userId: string, dto: CreateTeamDto): Promise<Team> {
  // ...
}
```

### 4. Interface Documentation

```typescript
/**
 * Configuration for AI providers
 * @interface
 */
export interface AIProviderConfig {
  /** API key for authentication */
  apiKey: string;
  
  /** Model name to use */
  model: string;
  
  /** Maximum tokens for generation */
  maxTokens?: number;
  
  /** Temperature for randomness (0-1) */
  temperature?: number;
}
```

### 5. Enum Documentation

```typescript
/**
 * Specification status types
 * @enum {string}
 */
export enum SpecificationStatus {
  /** Initial draft state */
  DRAFT = 'DRAFT',
  
  /** Under review by team */
  IN_REVIEW = 'IN_REVIEW',
  
  /** Approved and ready for implementation */
  APPROVED = 'APPROVED',
  
  /** Rejected and needs revision */
  REJECTED = 'REJECTED'
}
```

## 🏷️ Common JSDoc Tags

### Essential Tags

- `@param` - Document function parameters
- `@returns` - Document return value
- `@throws` - Document exceptions thrown
- `@example` - Provide usage examples
- `@see` - Reference related items
- `@since` - Version when added
- `@deprecated` - Mark as deprecated

### Categories (Custom)

Use `@category` to group related items:

- `Core Services` - Foundation services
- `Application Services` - Business logic
- `Gateway Services` - Entry points
- `DTOs` - Data transfer objects
- `Interfaces` - Type definitions
- `Guards` - Route guards
- `Decorators` - Custom decorators

### Visibility

- `@public` - Public API (default)
- `@private` - Private implementation
- `@protected` - Protected members
- `@internal` - Internal use only
- `@alpha` - Alpha feature
- `@beta` - Beta feature

## 📋 Documentation Checklist

For each file, ensure:

- [ ] File has header comment with purpose
- [ ] All exported classes are documented
- [ ] All public methods have JSDoc
- [ ] Parameters and returns are documented
- [ ] Complex logic has inline comments
- [ ] Examples provided for key features
- [ ] Interfaces and types are documented
- [ ] Enums have member descriptions

## 🎯 Best Practices

### 1. Be Concise but Complete

```typescript
/**
 * Validates user input
 * 
 * @param input - User input to validate
 * @returns True if valid, false otherwise
 */
// Good - concise but complete
```

### 2. Include Examples

```typescript
/**
 * Generates specification from requirements
 * 
 * @example
 * ```typescript
 * const spec = await service.generateSpecification({
 *   title: 'User Authentication',
 *   requirements: 'Build a secure login system...',
 *   teamId: 'team-123'
 * });
 * ```
 */
```

### 3. Document Edge Cases

```typescript
/**
 * Processes payment
 * 
 * @param amount - Amount in cents (must be >= 50)
 * @throws {BadRequestException} If amount < 50 cents
 * @throws {PaymentException} If payment processor fails
 */
```

### 4. Cross-Reference

```typescript
/**
 * Creates a specification
 * 
 * @see {@link SpecificationService.generateViews} For view generation
 * @see {@link QualityAssuranceService.validate} For validation
 */
```

### 5. Document Complex Types

```typescript
/**
 * Specification generation options
 * 
 * @typedef {Object} GenerationOptions
 * @property {boolean} [generateDiagrams=true] - Whether to generate diagrams
 * @property {('basic'|'detailed'|'comprehensive')} [detailLevel='detailed'] - Level of detail
 * @property {string[]} [includeSections] - Specific sections to include
 */
```

## 🚀 Quick Start Template

```typescript
/**
 * [Brief description of what this file/module does]
 * 
 * @module [ModuleName]
 * @category [Category]
 */

import { Injectable } from '@nestjs/common';

/**
 * [Service description]
 * 
 * [Longer description of what this service does, key features, etc.]
 * 
 * @category [Category]
 * @example
 * ```typescript
 * // Example usage
 * ```
 */
@Injectable()
export class MyService {
  /**
   * [Method description]
   * 
   * @param paramName - [Parameter description]
   * @returns [Return description]
   * @throws {ExceptionType} [When thrown]
   * 
   * @example
   * ```typescript
   * // Example usage
   * ```
   */
  async myMethod(paramName: string): Promise<ReturnType> {
    // Implementation
  }
}
```

## 📊 Generating Documentation

### Generate Full Documentation

```bash
# Generate HTML documentation
pnpm docs:generate

# Generate with custom options
npx typedoc --out docs/api --theme default
```

### View Documentation

```bash
# Serve documentation locally
pnpm docs:serve

# Open in browser
open http://localhost:8080
```

### CI/CD Integration

```yaml
# .github/workflows/docs.yml
- name: Generate Documentation
  run: pnpm docs:generate
  
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./docs/api
```

## 🔗 Resources

- [TypeDoc Documentation](https://typedoc.org/)
- [JSDoc Reference](https://jsdoc.app/)
- [TSDoc Specification](https://tsdoc.org/)

---

Remember: Good documentation is an investment in your project's future! 📚✨
