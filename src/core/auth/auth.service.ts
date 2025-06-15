//  Complete authentication service

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@core/database';
import { RegisterUserDto, LoginUserDto, TokenResponseDto, UpdateProfileDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { User } from '@prisma/client';

/**
 * Authentication Service
 *
 * Handles user authentication, registration, and token management.
 * This service is the central point for all authentication-related operations.
 *
 * @category Core Services
 * @module Authentication
 *
 * @example
 * ```typescript
 * // Inject the service
 * constructor(private authService: AuthService) {}
 *
 * // Register a new user
 * const user = await this.authService.register({
 *   email: 'user@example.com',
 *   password: 'securePassword123',
 *   name: 'John Doe'
 * });
 *
 * // Login
 * const tokens = await this.authService.login({
 *   email: 'user@example.com',
 *   password: 'securePassword123'
 * });
 * ```
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtExpiresIn: number;
  private readonly refreshExpiresIn: number;

  /**
   * Creates an instance of AuthService
   * @param prisma - Database service for user operations
   * @param jwtService - JWT service for token generation
   * @param configService - Configuration service for JWT settings
   */
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.jwtExpiresIn = this.configService.get<number>('JWT_EXPIRATION', 86400); // 1 day
    this.refreshExpiresIn = this.configService.get<number>('JWT_REFRESH_EXPIRATION', 604800); // 7 days
  }

  /**
   * Registers a new user in the system
   *
   * @param dto - Registration data
   * @param dto.email - User's email address (must be unique)
   * @param dto.password - Plain text password (will be hashed)
   * @param dto.name - User's display name
   * @returns The created user object and authentication tokens
   * @throws {BadRequestException} If email already exists
   *
   * @example
   * ```typescript
   * const result = await authService.register({
   *   email: 'newuser@example.com',
   *   password: 'MySecurePass123!',
   *   name: 'New User'
   * });
   * console.log(result.tokens.accessToken);
   * ```
   */
  async register(dto: RegisterUserDto): Promise<TokenResponseDto> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    // Generate tokens
    return this.generateTokens(user);
  }

  /**
   * Authenticates a user and returns access tokens
   *
   * @param dto - Login credentials
   * @param dto.email - User's email address
   * @param dto.password - User's password
   * @returns Authentication tokens and user information
   * @throws {UnauthorizedException} If credentials are invalid
   *
   * @see {@link validateUser} For user validation logic
   * @see {@link generateTokens} For token generation
   */
  async login(dto: LoginUserDto): Promise<TokenResponseDto> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in: ${user.email}`);

    return this.generateTokens(user);
  }

  /**
   * Validates user credentials
   *
   * @param email - User's email
   * @param password - Plain text password to verify
   * @returns User object if valid, null otherwise
   * @internal
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Refreshes authentication tokens
   *
   * @param refreshToken - Valid refresh token
   * @returns New token pair
   * @throws {UnauthorizedException} If refresh token is invalid or expired
   * @since 1.0.0
   * @deprecated Use {@link refreshTokensV2} instead (will be removed in 2.0.0)
   */
  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    this.logger.log(`User profile updated: ${user.email}`);

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Password changed for user: ${user.email}`);
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        subscriptionTier: true,
        preferences: true,
        createdAt: true,
        teamMemberships: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  /**
   * Generates JWT tokens for authenticated user
   *
   * @param user - User object
   * @returns Object containing access and refresh tokens
   * @private
   */
  private async generateTokens(user: User): Promise<TokenResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.jwtExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.jwtExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        subscriptionTier: user.subscriptionTier,
      },
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}

// ============================================

// /**
//  * Authentication response interface
//  *
//  * @interface AuthResponse
//  * @property {User} user - Authenticated user information
//  * @property {TokenPair} tokens - JWT tokens
//  */
// export interface AuthResponse {
//   /** Authenticated user information */
//   user: User;
//   /** JWT access and refresh tokens */
//   tokens: TokenPair;
// }

// /**
//  * Token pair interface
//  *
//  * @interface TokenPair
//  */
// export interface TokenPair {
//   /** JWT access token for API requests */
//   accessToken: string;
//   /** JWT refresh token for obtaining new access tokens */
//   refreshToken: string;
//   /** Access token expiration time in seconds */
//   expiresIn: number;
// }

// /**
//  * Authentication guard types
//  * @enum {string}
//  */
// export enum AuthGuardType {
//   /** JWT-based authentication */
//   JWT = 'jwt',
//   /** API key authentication */
//   API_KEY = 'api-key',
//   /** OAuth2 authentication */
//   OAUTH2 = 'oauth2'
// }
