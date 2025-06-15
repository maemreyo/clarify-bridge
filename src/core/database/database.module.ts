//  Complete Database module implementation

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';

/**
 * Global database module that provides PrismaService to all modules
 *
 * @Global decorator makes this module available throughout the application
 * without needing to import it in every module
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

// ============================================
