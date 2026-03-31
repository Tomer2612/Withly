import { Controller, Get, Post, Patch, Delete, UseGuards, Req, UseInterceptors, UploadedFile, UploadedFiles, Body, BadRequestException, Param, NotFoundException, Query } from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../common/storage.service';

// Image file filter - only allow image files
const imageFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException('אפשר להעלות רק קבצי תמונה'), false);
  }
  cb(null, true);
};

const storage = memoryStorage();

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  // Search users by name for @mentions - MUST be before :userId routes
  @UseGuards(AuthGuard('jwt'))
  @Get('search')
  async searchUsersByName(@Query('q') q: string, @Req() req) {
    return this.usersService.searchUsersByName(q || '', req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Req() req) {
    const user = await this.usersService.findById(req.user.userId);
    return {
      userId: user?.id,
      email: user?.email,
      name: user?.name,
      profileImage: user?.profileImage,
      coverImage: user?.coverImage,
      bio: user?.bio,
      location: user?.location,
      isGoogleAccount: !!user?.googleId,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'profileImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ], { storage, fileFilter: imageFileFilter }))
  async updateProfile(
    @Req() req,
    @Body() body: { name?: string; bio?: string; location?: string },
    @UploadedFiles() files?: { profileImage?: any[]; coverImage?: any[] },
  ) {
    const profileImage = files?.profileImage?.[0] ? await this.storageService.uploadFile(files.profileImage[0], 'profiles') : undefined;
    const coverImage = files?.coverImage?.[0] ? await this.storageService.uploadFile(files.coverImage[0], 'profiles') : undefined;
    const user = await this.usersService.updateProfile(req.user.userId, body.name, profileImage, coverImage, body.bio, body.location);
    return {
      userId: user?.id,
      email: user?.email,
      name: user?.name,
      profileImage: user?.profileImage,
      coverImage: user?.coverImage,
      bio: user?.bio,
      location: user?.location,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/online-status')
  async getOnlineStatus(@Req() req) {
    return this.usersService.getOnlineStatus(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me/online-status')
  async toggleOnlineStatus(@Req() req, @Body() body: { showOnline: boolean }) {
    return this.usersService.toggleOnlineStatus(req.user.userId, body.showOnline);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/notification-preferences')
  async getNotificationPreferences(@Req() req) {
    return this.usersService.getNotificationPreferences(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me/notification-preferences')
  async updateNotificationPreferences(
    @Req() req,
    @Body() body: {
      notifyLikes?: boolean;
      notifyComments?: boolean;
      notifyFollows?: boolean;
      notifyNewPosts?: boolean;
      notifyMentions?: boolean;
      notifyCommunityJoins?: boolean;
      notifyMessages?: boolean;
    },
  ) {
    return this.usersService.updateNotificationPreferences(req.user.userId, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me/password')
  async changePassword(
    @Req() req,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException('Current and new password are required');
    }
    if (body.newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }
    await this.usersService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
    return { message: 'Password changed successfully' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('me')
  async deleteAccount(@Req() req) {
    return this.usersService.deleteAccount(req.user.userId);
  }

  // Public endpoints - no auth required
  @Get(':userId')
  async getPublicProfile(@Param('userId') userId: string) {
    const profile = await this.usersService.getPublicProfile(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile;
  }

  @Get(':userId/communities/created')
  async getCreatedCommunities(@Param('userId') userId: string) {
    return this.usersService.getCreatedCommunities(userId);
  }

  @Get(':userId/communities/member')
  async getMemberCommunities(@Param('userId') userId: string) {
    return this.usersService.getMemberCommunities(userId);
  }

  // Get user profile stats (followers, following, community members)
  @Get(':userId/stats')
  async getUserStats(@Param('userId') userId: string) {
    return this.usersService.getUserStats(userId);
  }

  // Follow a user
  @UseGuards(AuthGuard('jwt'))
  @Post(':userId/follow')
  async followUser(@Req() req, @Param('userId') userId: string) {
    if (req.user.userId === userId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const result = await this.usersService.followUser(req.user.userId, userId);
    
    // Send follow notification
    await this.notificationsService.notifyFollow(userId, req.user.userId);
    
    return result;
  }

  // Unfollow a user
  @UseGuards(AuthGuard('jwt'))
  @Delete(':userId/follow')
  async unfollowUser(@Req() req, @Param('userId') userId: string) {
    return this.usersService.unfollowUser(req.user.userId, userId);
  }

  // Check if current user follows a specific user
  @UseGuards(AuthGuard('jwt'))
  @Get(':userId/is-following')
  async isFollowing(@Req() req, @Param('userId') userId: string) {
    return this.usersService.isFollowing(req.user.userId, userId);
  }

  // Payment Methods
  @UseGuards(AuthGuard('jwt'))
  @Get('me/payment-methods')
  async getPaymentMethods(@Req() req) {
    return this.usersService.getPaymentMethods(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/payment-methods')
  async addPaymentMethod(
    @Req() req,
    @Body() body: { cardLastFour: string; cardBrand?: string },
  ) {
    return this.usersService.addPaymentMethod(
      req.user.userId,
      body.cardLastFour,
      body.cardBrand || 'Visa',
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('me/payment-methods/:id')
  async deletePaymentMethod(@Req() req, @Param('id') id: string) {
    return this.usersService.deletePaymentMethod(req.user.userId, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me/payment-methods/:id/set-primary')
  async setPrimaryPaymentMethod(@Req() req, @Param('id') id: string) {
    return this.usersService.setPrimaryPaymentMethod(req.user.userId, id);
  }
}
