import { Controller, Get, Post, Body, UseGuards, Req, Param, Put, Patch, Delete, Query, UseInterceptors, UploadedFile, UploadedFiles, Headers } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { CommunitiesService } from './communities.service';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../common/storage.service';
import { getUserIdFromAuthHeader } from '../common/jwt.helper';
import { imageFileFilter, imageOrVideoFileFilter } from '../common/upload-filters';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  UpdateMemberRoleDto,
  UpdateRulesDto,
  UpdateSlugDto,
} from './dto/communities.dto';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const storage = memoryStorage();

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ], { storage, fileFilter: imageFileFilter }))
  async create(
    @Req() req,
    @Body() body: CreateCommunityDto,
    @UploadedFiles() files?: { image?: Express.Multer.File[]; logo?: Express.Multer.File[]; galleryImages?: Express.Multer.File[] },
  ) {
    const userId = req.user.userId;
    const { name, description, topic, youtubeUrl, whatsappUrl, facebookUrl, instagramUrl } = body;
    const imagePath = files?.image?.[0] ? await this.storageService.uploadFile(files.image[0], 'communities') : null;
    const logoPath = files?.logo?.[0] ? await this.storageService.uploadFile(files.logo[0], 'communities') : null;
    const galleryPaths = files?.galleryImages ? await this.storageService.uploadFiles(files.galleryImages, 'communities') : [];

    return this.communitiesService.create(
      name, 
      description, 
      userId, 
      imagePath,
      logoPath,
      topic,
      youtubeUrl,
      whatsappUrl,
      facebookUrl,
      instagramUrl,
      galleryPaths,
    );
  }

  @Get()
  findAll() {
    return this.communitiesService.findAll();
  }

  @Get('check-slug/:slug')
  async checkSlug(@Param('slug') slug: string, @Query('excludeId') excludeId?: string) {
    const isAvailable = await this.communitiesService.isSlugAvailable(slug, excludeId);
    return { available: isAvailable };
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const viewerUserId = getUserIdFromAuthHeader(authHeader);
    return this.communitiesService.findById(id, viewerUserId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
    { name: 'galleryVideoFiles', maxCount: 5 },
  ], { storage, fileFilter: imageOrVideoFileFilter, limits: { fileSize: MAX_VIDEO_SIZE } }))
  async update(
    @Param('id') id: string,
    @Req() req,
    @Body() body: UpdateCommunityDto,
    @UploadedFiles() files?: { image?: Express.Multer.File[]; logo?: Express.Multer.File[]; galleryImages?: Express.Multer.File[]; galleryVideoFiles?: Express.Multer.File[] },
  ) {
    const userId = req.user.userId;
    let imagePath: string | null | undefined = undefined;
    let logoPath: string | null | undefined = undefined;
    
    if (files?.image?.[0]) {
      // New image uploaded
      imagePath = await this.storageService.uploadFile(files.image[0], 'communities');
    } else if (body.existingPrimaryImage) {
      // Keep existing primary image (don't change it)
      imagePath = body.existingPrimaryImage;
    } else if (body.removeImage === 'true') {
      // Remove image
      imagePath = null;
    }
    
    if (files?.logo?.[0]) {
      // New logo uploaded
      logoPath = await this.storageService.uploadFile(files.logo[0], 'communities');
    } else if (body.existingLogo) {
      // Keep existing logo
      logoPath = body.existingLogo;
    } else if (body.removeLogo === 'true') {
      // Remove logo
      logoPath = null;
    }
    
    const newGalleryPaths = files?.galleryImages ? await this.storageService.uploadFiles(files.galleryImages, 'communities') : [];
    const existingGallery = body.existingGalleryImages ? JSON.parse(body.existingGalleryImages) : [];
    const galleryImages = [...existingGallery, ...newGalleryPaths];
    
    // Handle gallery videos: merge existing URLs + newly uploaded MP4s
    const existingVideoUrls = body.existingGalleryVideos ? JSON.parse(body.existingGalleryVideos) : [];
    const uploadedVideoPaths = files?.galleryVideoFiles ? await this.storageService.uploadFiles(files.galleryVideoFiles, 'communities') : [];
    const galleryVideos = [...existingVideoUrls, ...uploadedVideoPaths];
    
    const price = body.price !== undefined ? parseFloat(body.price) : undefined;
    
    return this.communitiesService.update(
      id,
      userId,
      body.name,
      body.description,
      imagePath,
      logoPath,
      body.topic,
      body.youtubeUrl,
      body.whatsappUrl,
      body.facebookUrl,
      body.instagramUrl,
      galleryImages,
      galleryVideos,
      price,
      body.trialCancelled,
      body.cardLastFour,
      body.cardBrand,
      body.showOnlineMembers !== undefined ? body.showOnlineMembers === 'true' : undefined,
      body.status,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  delete(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.communitiesService.delete(id, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/join')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 joins per minute
  async join(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    const result = await this.communitiesService.joinCommunity(id, userId);
    
    // Notify community owner if this is a new join
    if (result.message === 'Joined community') {
      const community = await this.communitiesService.findById(id);
      if (community) {
        await this.notificationsService.notifyCommunityJoin(
          community.ownerId,
          userId,
          id,
        );
      }
    }
    
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/leave')
  leave(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.communitiesService.leaveCommunity(id, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/membership')
  checkMembership(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.communitiesService.checkMembership(id, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id/members/:memberId/role')
  updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberRoleDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.communitiesService.updateMemberRole(id, memberId, body.role, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const result = await this.communitiesService.removeMember(id, memberId, userId);
    // Notify the banned user. Fire-and-forget — the ban itself succeeded
    // and a downstream notification glitch shouldn't fail the response.
    const community = await this.communitiesService.findById(id, userId).catch(() => null);
    if (community) {
      this.notificationsService.notifyCommunityBan(memberId, userId, community.id).catch(() => {});
    }
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/memberships')
  getUserMemberships(@Req() req) {
    const userId = req.user.userId;
    return this.communitiesService.getUserMemberships(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/my-communities')
  getUserCommunitiesWithDetails(@Req() req) {
    const userId = req.user.userId;
    return this.communitiesService.getUserCommunitiesWithDetails(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/members')
  getCommunityMembers(@Param('id') id: string) {
    return this.communitiesService.getCommunityMembers(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/banned')
  getBannedUsers(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.communitiesService.getBannedUsers(id, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/banned/:banId')
  async liftBan(@Param('id') id: string, @Param('banId') banId: string, @Req() req) {
    const userId = req.user.userId;
    const result = await this.communitiesService.liftBan(id, banId, userId);
    // Notify the unbanned user. Fire-and-forget.
    this.notificationsService.notifyCommunityBanLifted(
      result.unbannedUserId,
      userId,
      result.communityId,
    ).catch(() => {});
    return { message: result.message };
  }

  @Get(':id/managers')
  getCommunityManagers(@Param('id') id: string) {
    return this.communitiesService.getCommunityManagers(id);
  }

  @Get(':id/online-count')
  getOnlineMembersCount(@Param('id') id: string) {
    return this.communitiesService.getOnlineMembersCount(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/top-members')
  getTopMembers(@Param('id') id: string, @Query('limit') limit?: string) {
    const memberLimit = limit ? parseInt(limit, 10) : 3;
    return this.communitiesService.getTopMembers(id, Math.min(memberLimit, 100));
  }

  @Get(':id/rules')
  getRules(@Param('id') id: string) {
    return this.communitiesService.getRules(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/rules')
  updateRules(
    @Param('id') id: string,
    @Body() body: UpdateRulesDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.communitiesService.updateRules(id, userId, body.rules);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/slug')
  updateSlug(
    @Param('id') id: string,
    @Body() body: UpdateSlugDto,
  ) {
    return this.communitiesService.updateSlug(id, body.slug);
  }
}
