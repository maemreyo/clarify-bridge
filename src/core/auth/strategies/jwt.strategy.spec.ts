import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { PrismaService } from '@core/database';
import { User } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: User = {
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

  const mockJwtPayload: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    iat: 1234567890,
    exp: 1234567890,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);

    // Setup default config
    configService.get.mockReturnValue('test-jwt-secret');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should retrieve JWT secret from config', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('validate', () => {
    it('should validate and return user for valid payload', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await strategy.validate(mockJwtPayload);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockJwtPayload.sub },
      });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        subscriptionTier: mockUser.subscriptionTier,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(mockJwtPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockJwtPayload)).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, isActive: false };
      prismaService.user.findUnique.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(strategy.validate(mockJwtPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(mockJwtPayload)).rejects.toThrow('User account is deactivated');
    });

    it('should handle database errors', async () => {
      // Arrange
      prismaService.user.findUnique.mockRejectedValue(new Error('Database connection error'));

      // Act & Assert
      await expect(strategy.validate(mockJwtPayload)).rejects.toThrow('Database connection error');
    });

    it('should validate payload with different subscription tiers', async () => {
      // Arrange
      const premiumUser = { ...mockUser, subscriptionTier: 'PREMIUM' };
      prismaService.user.findUnique.mockResolvedValue(premiumUser);

      // Act
      const result = await strategy.validate(mockJwtPayload);

      // Assert
      expect(result.subscriptionTier).toBe('PREMIUM');
    });

    it('should handle payload with missing fields gracefully', async () => {
      // Arrange
      const incompletePayload = { sub: 'user-123' } as JwtPayload;
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await strategy.validate(incompletePayload);

      // Assert
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        subscriptionTier: mockUser.subscriptionTier,
      });
    });

    it('should validate recently updated user', async () => {
      // Arrange
      const recentlyUpdatedUser = {
        ...mockUser,
        updatedAt: new Date(),
        name: 'Updated Name',
      };
      prismaService.user.findUnique.mockResolvedValue(recentlyUpdatedUser);

      // Act
      const result = await strategy.validate(mockJwtPayload);

      // Assert
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('edge cases', () => {
    it('should handle null or undefined payload', async () => {
      // Act & Assert
      await expect(strategy.validate(null as any)).rejects.toThrow();
      await expect(strategy.validate(undefined as any)).rejects.toThrow();
    });

    it('should handle payload with invalid user ID format', async () => {
      // Arrange
      const invalidPayload: JwtPayload = {
        sub: '',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 1234567890,
      };
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(invalidPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle concurrent validation requests', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const promises = Array(5).fill(null).map(() => strategy.validate(mockJwtPayload));
      const results = await Promise.all(promises);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(5);
      results.forEach(result => {
        expect(result.id).toBe(mockUser.id);
      });
    });
  });
});