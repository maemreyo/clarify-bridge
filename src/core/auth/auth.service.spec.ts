import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '@core/database';
import { RegisterUserDto, LoginUserDto, UpdateProfileDto } from './dto/auth.dto';
import { User } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
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

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 86400,
    user: {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      avatar: mockUser.avatar,
      subscriptionTier: mockUser.subscriptionTier,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
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

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        JWT_EXPIRATION: 86400,
        JWT_REFRESH_EXPIRATION: 604800,
      };
      return config[key] || defaultValue;
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterUserDto = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      name: 'New User',
    };

    it('should successfully register a new user', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          name: registerDto.name,
          password: 'hashedPassword',
        },
      });
      expect(result).toEqual(mockTokens);
    });

    it('should throw ConflictException if user already exists', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during registration', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockRejectedValue(new Error('Database error'));
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow('Database error');
    });
  });

  describe('login', () => {
    const loginDto: LoginUserDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully login a user with valid credentials', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(result).toEqual(mockTokens);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, isActive: false };
      prismaService.user.findUnique.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';
    const decodedPayload = { sub: 'user-123', email: 'test@example.com' };

    it('should successfully refresh tokens with valid refresh token', async () => {
      // Arrange
      jwtService.verify.mockReturnValue(decodedPayload);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      // Act
      const result = await service.refreshToken(refreshToken);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: decodedPayload.sub },
      });
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      jwtService.verify.mockReturnValue(decodedPayload);
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile successfully', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserProfile(mockUser.id);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          subscriptionTier: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        avatar: mockUser.avatar,
        subscriptionTier: mockUser.subscriptionTier,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserProfile('invalid-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateProfileDto = {
      name: 'Updated Name',
      avatar: 'https://example.com/avatar.png',
    };

    it('should successfully update user profile', async () => {
      // Arrange
      const updatedUser = { ...mockUser, ...updateDto };
      prismaService.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateProfile(mockUser.id, updateDto);

      // Assert
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: updateDto,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          subscriptionTier: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result.name).toBe(updateDto.name);
      expect(result.avatar).toBe(updateDto.avatar);
    });

    it('should handle database errors during profile update', async () => {
      // Arrange
      prismaService.user.update.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.updateProfile(mockUser.id, updateDto)).rejects.toThrow('Database error');
    });
  });

  describe('changePassword', () => {
    const currentPassword = 'oldPassword123';
    const newPassword = 'newPassword123';

    it('should successfully change password with valid current password', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      prismaService.user.update.mockResolvedValue({ ...mockUser, password: 'newHashedPassword' });

      // Act
      await service.changePassword(mockUser.id, currentPassword, newPassword);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, mockUser.password);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { password: 'newHashedPassword' },
      });
    });

    it('should throw UnauthorizedException for invalid current password', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.changePassword(mockUser.id, currentPassword, newPassword),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.changePassword('invalid-id', currentPassword, newPassword),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if new password is same as current', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password check
        .mockResolvedValueOnce(true); // new password comparison

      // Act & Assert
      await expect(
        service.changePassword(mockUser.id, currentPassword, currentPassword),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle bcrypt errors gracefully', async () => {
      // Arrange
      const registerDto: RegisterUserDto = {
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      };
      prismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow('Bcrypt error');
    });

    it('should handle JWT signing errors', async () => {
      // Arrange
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password',
      };
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockImplementation(() => {
        throw new Error('JWT error');
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow('JWT error');
    });
  });
});
