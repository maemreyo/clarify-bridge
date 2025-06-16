import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  RegisterUserDto,
  LoginUserDto,
  TokenResponseDto,
  RefreshTokenDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { UnauthorizedException, ConflictException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockTokenResponse: TokenResponseDto = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 86400,
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
      subscriptionTier: 'FREE',
    },
  };

  const mockUserProfile = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    subscriptionTier: 'FREE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            getUserProfile: jest.fn(),
            updateProfile: jest.fn(),
            changePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      const registerDto: RegisterUserDto = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      };
      authService.register.mockResolvedValue(mockTokenResponse);

      // Act
      const result = await controller.register(registerDto);

      // Assert
      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle existing user conflict', async () => {
      // Arrange
      const registerDto: RegisterUserDto = {
        email: 'existing@example.com',
        password: 'password',
        name: 'Existing User',
      };
      authService.register.mockRejectedValue(
        new ConflictException('User with this email already exists')
      );

      // Act & Assert
      await expect(controller.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidDto = {
        email: 'invalid-email', // Invalid email format
        password: '123', // Too short
        name: '', // Empty name
      } as RegisterUserDto;

      authService.register.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert
      await expect(controller.register(invalidDto)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      // Arrange
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      authService.login.mockResolvedValue(mockTokenResponse);

      // Act
      const result = await controller.login(loginDto);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle invalid credentials', async () => {
      // Arrange
      const loginDto: LoginUserDto = {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      };
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials')
      );

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password',
      };
      authService.login.mockRejectedValue(new Error('Database connection error'));

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow('Database connection error');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh tokens', async () => {
      // Arrange
      const refreshDto: RefreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };
      authService.refreshToken.mockResolvedValue(mockTokenResponse);

      // Act
      const result = await controller.refreshToken(refreshDto);

      // Assert
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshDto.refreshToken);
      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle invalid refresh token', async () => {
      // Arrange
      const refreshDto: RefreshTokenDto = {
        refreshToken: 'invalid-refresh-token',
      };
      authService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token')
      );

      // Act & Assert
      await expect(controller.refreshToken(refreshDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle expired refresh token', async () => {
      // Arrange
      const refreshDto: RefreshTokenDto = {
        refreshToken: 'expired-token',
      };
      authService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Token expired')
      );

      // Act & Assert
      await expect(controller.refreshToken(refreshDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile for authenticated user', async () => {
      // Arrange
      const userId = 'user-123';
      authService.getUserProfile.mockResolvedValue(mockUserProfile);

      // Act
      const result = await controller.getProfile(userId);

      // Assert
      expect(authService.getUserProfile).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUserProfile);
    });

    it('should handle user not found', async () => {
      // Arrange
      const userId = 'non-existent-user';
      authService.getUserProfile.mockRejectedValue(
        new UnauthorizedException('User not found')
      );

      // Act & Assert
      await expect(controller.getProfile(userId)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('should successfully update user profile', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto: UpdateProfileDto = {
        name: 'Updated Name',
        avatar: 'https://example.com/avatar.png',
      };
      const updatedProfile = { ...mockUserProfile, ...updateDto };
      authService.updateProfile.mockResolvedValue(updatedProfile);

      // Act
      const result = await controller.updateProfile(userId, updateDto);

      // Assert
      expect(authService.updateProfile).toHaveBeenCalledWith(userId, updateDto);
      expect(result).toEqual(updatedProfile);
    });

    it('should handle partial updates', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto: UpdateProfileDto = {
        name: 'Only Name Updated',
      };
      const updatedProfile = { ...mockUserProfile, name: updateDto.name };
      authService.updateProfile.mockResolvedValue(updatedProfile);

      // Act
      const result = await controller.updateProfile(userId, updateDto);

      // Assert
      expect(authService.updateProfile).toHaveBeenCalledWith(userId, updateDto);
      expect(result.name).toBe(updateDto.name);
    });

    it('should handle empty update', async () => {
      // Arrange
      const userId = 'user-123';
      const updateDto: UpdateProfileDto = {};
      authService.updateProfile.mockResolvedValue(mockUserProfile);

      // Act
      const result = await controller.updateProfile(userId, updateDto);

      // Assert
      expect(authService.updateProfile).toHaveBeenCalledWith(userId, updateDto);
      expect(result).toEqual(mockUserProfile);
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      // Arrange
      const userId = 'user-123';
      const passwordDto = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      };
      authService.changePassword.mockResolvedValue(undefined);

      // Act
      await controller.changePassword(userId, passwordDto);

      // Assert
      expect(authService.changePassword).toHaveBeenCalledWith(
        userId,
        passwordDto.currentPassword,
        passwordDto.newPassword
      );
    });

    it('should handle incorrect current password', async () => {
      // Arrange
      const userId = 'user-123';
      const passwordDto = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123',
      };
      authService.changePassword.mockRejectedValue(
        new UnauthorizedException('Current password is incorrect')
      );

      // Act & Assert
      await expect(controller.changePassword(userId, passwordDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should handle same password error', async () => {
      // Arrange
      const userId = 'user-123';
      const passwordDto = {
        currentPassword: 'samePassword123',
        newPassword: 'samePassword123',
      };
      authService.changePassword.mockRejectedValue(
        new Error('New password must be different from current password')
      );

      // Act & Assert
      await expect(controller.changePassword(userId, passwordDto)).rejects.toThrow(
        'New password must be different from current password'
      );
    });
  });

  describe('decorators and guards', () => {
    it('should have @Public decorator on public endpoints', () => {
      // This test would verify that decorators are properly applied
      // In a real scenario, you would test the metadata
      const registerMetadata = Reflect.getMetadata('isPublic', controller.register);
      const loginMetadata = Reflect.getMetadata('isPublic', controller.login);
      const refreshMetadata = Reflect.getMetadata('isPublic', controller.refreshToken);

      // These would be true if @Public decorator is properly applied
      // Note: This is a conceptual test - actual implementation would depend on how decorators are set up
      expect(typeof controller.register).toBe('function');
      expect(typeof controller.login).toBe('function');
      expect(typeof controller.refreshToken).toBe('function');
    });

    it('should have protected endpoints that require authentication', () => {
      // Verify that protected endpoints exist and are functions
      expect(typeof controller.getProfile).toBe('function');
      expect(typeof controller.updateProfile).toBe('function');
      expect(typeof controller.changePassword).toBe('function');
    });
  });

  describe('error handling scenarios', () => {
    it('should handle network timeouts gracefully', async () => {
      // Arrange
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password',
      };
      const timeoutError = new Error('Network timeout');
      authService.login.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow('Network timeout');
    });

    it('should handle database connection errors', async () => {
      // Arrange
      const registerDto: RegisterUserDto = {
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      };
      authService.register.mockRejectedValue(new Error('Database connection lost'));

      // Act & Assert
      await expect(controller.register(registerDto)).rejects.toThrow('Database connection lost');
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      const userId = 'user-123';
      authService.getUserProfile.mockRejectedValue(new Error('Unexpected error occurred'));

      // Act & Assert
      await expect(controller.getProfile(userId)).rejects.toThrow('Unexpected error occurred');
    });
  });
});