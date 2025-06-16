import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(
    @CurrentUser() user: any,
    @Query('read') read?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationService.getUserNotifications(user.id, {
      read,
      offset: (page - 1) * limit || 0,
      limit: limit || 20,
    });
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@CurrentUser() user: any, @Param('id') notificationId: string) {
    await this.notificationService.markAsRead(notificationId, user.id);
  }

  @Put('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: any) {
    await this.notificationService.markAllAsRead(user.id);
  }
}
