# Unit Testing Guide - The Clarity Bridge

## 📚 Overview

This guide provides patterns and best practices for implementing unit tests across The Clarity Bridge application. Follow these patterns to ensure consistent, maintainable, and comprehensive test coverage.

## 🎯 Testing Strategy

### Test Structure

Each test file should follow this structure:

1. **Imports** - Testing framework and dependencies
2. **Mock Setup** - Mock objects and data
3. **Test Suite** - Describe blocks for logical grouping
4. **Test Cases** - Individual test scenarios

### Naming Conventions

- Test files: `*.spec.ts` (e.g., `auth.service.spec.ts`)
- Test suites: Use `describe('ClassName', () => {})`
- Test cases: Use descriptive names starting with "should"

## 🔧 Common Testing Patterns

### 1. Service Testing Pattern

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let dependency: jest.Mocked<DependencyType>;

  // Mock data
  const mockData = {
    /* ... */
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: DependencyType,
          useValue: {
            method1: jest.fn(),
            method2: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
    dependency = module.get(DependencyType);

    jest.clearAllMocks();
  });

  // Test cases...
});
```

### 2. Controller Testing Pattern

```typescript
describe('ControllerName', () => {
  let controller: ControllerName;
  let service: jest.Mocked<ServiceType>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ControllerName],
      providers: [
        {
          provide: ServiceType,
          useValue: {
            method1: jest.fn(),
            method2: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ControllerName>(ControllerName);
    service = module.get(ServiceType);
  });

  // Test cases...
});
```

### 3. Guard Testing Pattern

```typescript
describe('GuardName', () => {
  let guard: GuardName;
  let reflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (options = {}): ExecutionContext =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: options.user,
          headers: options.headers || {},
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  // Test cases...
});
```

## 📋 Testing Checklist

For each module, ensure you test:

### Services

- [ ] **Happy Path**: Normal operation scenarios
- [ ] **Error Handling**: Exception scenarios
- [ ] **Edge Cases**: Boundary conditions
- [ ] **Data Validation**: Input validation
- [ ] **Business Logic**: Complex calculations/transformations
- [ ] **Database Interactions**: CRUD operations
- [ ] **External Dependencies**: Mocked appropriately

### Controllers

- [ ] **Route Handlers**: All endpoints
- [ ] **Request Validation**: DTO validation
- [ ] **Response Format**: Correct response structure
- [ ] **Status Codes**: Appropriate HTTP status codes
- [ ] **Error Responses**: Exception handling
- [ ] **Guards/Decorators**: Security checks

### Guards & Middleware

- [ ] **Authorization Logic**: Permission checks
- [ ] **Context Handling**: Request/response manipulation
- [ ] **Error Scenarios**: Unauthorized access
- [ ] **Metadata Reflection**: Decorator integration

## 🎪 Mock Data Standards

### User Mock

```typescript
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  password: 'hashedPassword',
  avatar: null,
  subscriptionTier: 'FREE',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### Team Mock

```typescript
const mockTeam = {
  id: 'team-123',
  name: 'Test Team',
  slug: 'test-team',
  description: 'Test description',
  ownerId: 'user-123',
  subscriptionTier: 'FREE',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### Specification Mock

```typescript
const mockSpecification = {
  id: 'spec-123',
  title: 'Test Specification',
  description: 'Test description',
  status: 'DRAFT',
  userId: 'user-123',
  teamId: 'team-123',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## 🚀 Best Practices

### 1. AAA Pattern

Follow the Arrange-Act-Assert pattern:

```typescript
it('should do something', async () => {
  // Arrange
  const input = {
    /* test data */
  };
  mockService.method.mockResolvedValue(expectedResult);

  // Act
  const result = await service.methodUnderTest(input);

  // Assert
  expect(mockService.method).toHaveBeenCalledWith(input);
  expect(result).toEqual(expectedResult);
});
```

### 2. Test Isolation

- Each test should be independent
- Use `beforeEach` to reset state
- Clear all mocks between tests

### 3. Descriptive Test Names

```typescript
// ❌ Bad
it('test login', () => {});

// ✅ Good
it('should return tokens when login with valid credentials', () => {});
it('should throw UnauthorizedException when password is incorrect', () => {});
```

### 4. Mock External Dependencies

```typescript
// Mock external services
jest.mock('@langchain/openai');
jest.mock('stripe');
jest.mock('bull');
```

### 5. Test Error Scenarios

```typescript
it('should handle database connection errors gracefully', async () => {
  // Arrange
  prismaService.user.findUnique.mockRejectedValue(new Error('Connection lost'));

  // Act & Assert
  await expect(service.getUserById('123')).rejects.toThrow('Connection lost');
});
```

## 📊 Coverage Goals

Target coverage by module type:

- **Services**: 90% (business logic)
- **Controllers**: 80% (endpoints)
- **Guards/Middleware**: 85% (security)
- **Utilities**: 95% (pure functions)
- **Overall**: 80% minimum

## 🔍 Common Testing Scenarios

### 1. Testing Async Operations

```typescript
it('should handle async operations', async () => {
  const promise = service.asyncMethod();
  await expect(promise).resolves.toBe(expectedValue);
});
```

### 2. Testing Transactions

```typescript
it('should handle database transactions', async () => {
  prismaService.$transaction.mockImplementation(async callback => {
    return callback(prismaService);
  });

  await service.transactionalMethod();

  expect(prismaService.$transaction).toHaveBeenCalled();
});
```

### 3. Testing WebSockets

```typescript
it('should emit event to clients', () => {
  const mockServer = { emit: jest.fn() };
  gateway.server = mockServer;

  gateway.handleEvent(data);

  expect(mockServer.emit).toHaveBeenCalledWith('event-name', data);
});
```

### 4. Testing Queues

```typescript
it('should add job to queue', async () => {
  const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-123' }) };

  await service.queueJob(data);

  expect(mockQueue.add).toHaveBeenCalledWith('job-type', data);
});
```

## 🛠️ Testing Commands

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test auth.service.spec.ts

# Run tests for specific module
pnpm test --testPathPattern=core/auth

# Debug tests
pnpm test:debug
```

## 📝 Example Test Implementation

Here's a complete example following all best practices:

```typescript
// src/services/example.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExampleService } from './example.service';
import { PrismaService } from '@core/database';

describe('ExampleService', () => {
  let service: ExampleService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockData = {
    id: 'example-123',
    name: 'Test Example',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExampleService,
        {
          provide: PrismaService,
          useValue: {
            example: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ExampleService>(ExampleService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create example successfully', async () => {
      // Arrange
      const dto = { name: 'New Example' };
      prismaService.example.create.mockResolvedValue(mockData);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(prismaService.example.create).toHaveBeenCalledWith({
        data: dto,
      });
      expect(result).toEqual(mockData);
    });

    it('should throw BadRequestException for invalid input', async () => {
      // Arrange
      const dto = { name: '' };

      // Act & Assert
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(prismaService.example.create).not.toHaveBeenCalled();
    });
  });

  // More test cases...
});
```

## 🎯 Next Steps

1. **Start with Core Services**: Begin testing critical services like Auth, Team, and Payment
2. **Move to Controllers**: Test all API endpoints
3. **Test Guards & Middleware**: Ensure security layers are properly tested
4. **Application Services**: Test business logic modules
5. **Integration Tests**: Once unit tests are complete, add integration tests

Remember: Good tests are as important as good code. They serve as documentation, prevent regressions, and enable confident refactoring!
