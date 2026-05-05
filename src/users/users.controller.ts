import { Controller, Get, Post, Patch, Delete, UseGuards, Req, UseInterceptors, UploadedFile, UploadedFiles, Body, BadRequestException, Param, NotFoundException, Query } from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../common/storage.service';
import { imageFileFilter } from '../common/upload-filters';
import { getUserIdFromRequest } from '../common/jwt.helper';
import {
  UpdateProfileDto,
  ToggleOnlineStatusDto,
  UpdateNotificationPreferencesDto,
  ChangePasswordDto,
  AddPaymentMethodDto,
} from './dto/users.dto';

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
    @Body() body: UpdateProfileDto,
    @UploadedFiles() files?: { profileImage?: Express.Multer.File[]; coverImage?: Express.Multer.File[] },
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
  async toggleOnlineStatus(@Req() req, @Body() body: ToggleOnlineStatusDto) {
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
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(req.user.userId, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me/password')
  async changePassword(
    @Req() req,
    @Body() body: ChangePasswordDto,
  ) {
    // ValidationPipe already enforces presence + min length 6 on newPassword.
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

  // Public — profile pages render for anonymous viewers, who see the
  // user's created/joined communities and follower stats as social proof.
  // Viewer identity (if logged in) is used to widen visibility for the
  // user viewing their own profile (sees DRAFT/PRIVATE/SUSPENDED/pending);
  // outside viewers only see fully-public, active, non-cancelled rows.
  @Get(':userId/communities/created')
  async getCreatedCommunities(@Param('userId') userId: string, @Req() req) {
    const viewerUserId = getUserIdFromRequest(req);
    return this.usersService.getCreatedCommunities(userId, viewerUserId);
  }

  @Get(':userId/communities/member')
  async getMemberCommunities(@Param('userId') userId: string, @Req() req) {
    const viewerUserId = getUserIdFromRequest(req);
    return this.usersService.getMemberCommunities(userId, viewerUserId);
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
    @Body() body: AddPaymentMethodDto,
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
