import { Controller, Get, Post, Delete, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Get all notifications for current user
  @Get()
  async getNotifications(
    @Req() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getNotifications(
      req.user.userId,
      Math.min(limit ? parseInt(limit, 10) : 50, 50),
      offset ? parseInt(offset, 10) : 0,
    );
  }

  // Get unread count only
  @Get('unread-count')
  async getUnreadCount(@Req() req) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  // Mark all notifications as read (must be before parameterized routes)
  @Post('read-all')
  async markAllAsRead(@Req() req) {
    await this.notificationsService.markAllAsRead(req.user.userId);
    return { success: true };
  }

  // Mark a specific notification as read
  @Post(':id/read')
  async markAsRead(@Req() req, @Param('id') id: string) {
    await this.notificationsService.markAsRead(id, req.user.userId);
    return { success: true };
  }

  // Delete all notifications for the current user. Must come before the
  // parameterized :id route or the literal "all" would be treated as an id.
  @Delete('all')
  async deleteAll(@Req() req) {
    await this.notificationsService.deleteAll(req.user.userId);
    return { success: true };
  }

  // Delete a notification
  @Delete(':id')
  async deleteNotification(@Req() req, @Param('id') id: string) {
    await this.notificationsService.delete(id, req.user.userId);
    return { success: true };
  }
}
