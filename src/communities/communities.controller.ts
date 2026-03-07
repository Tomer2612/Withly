import { Controller, Get, Post, Body, UseGuards, Req, Param, Put, Patch, Delete, Query, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Throttle } from '@nestjs/throttler';
import { CommunitiesService } from './communities.service';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from '../notifications/notifications.service';

// Image file filter - only allow image files
const imageFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException('אפשר להעלות רק קבצי תמונה'), false);
  }
  cb(null, true);
};

// Configure multer storage
const storage = diskStorage({
  destination: './uploads/communities',
  filename: (req, file, cb) => {
    const randomName = Array(32)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
    cb(null, `${randomName}${extname(file.originalname)}`);
  },
});

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ], { storage, fileFilter: imageFileFilter }))
  create(
    @Req() req,
    @Body() body: any,
    @UploadedFiles() files?: { image?: any[]; logo?: any[]; galleryImages?: any[] },
  ) {
    const userId = req.user.userId;
    const { name, description, topic, youtubeUrl, whatsappUrl, facebookUrl, instagramUrl } = body;
    const imagePath = files?.image?.[0] ? `/uploads/communities/${files.image[0].filename}` : null;
    const logoPath = files?.logo?.[0] ? `/uploads/communities/${files.logo[0].filename}` : null;
    const galleryPaths = files?.galleryImages?.map(f => `/uploads/communities/${f.filename}`) || [];
    
    console.log('Create community - name:', name, 'description:', description, 'imagePath:', imagePath, 'logoPath:', logoPath);
    
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
  findOne(@Param('id') id: string) {
    return this.communitiesService.findById(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ], { storage, fileFilter: imageFileFilter }))
  update(
    @Param('id') id: string,
    @Req() req,
    @Body() body: { 
      name?: string; 
      description?: string; 
      topic?: string | null; 
      removeImage?: string;
      removeLogo?: string;
      youtubeUrl?: string;
      whatsappUrl?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      existingGalleryImages?: string;
      existingGalleryVideos?: string;
      existingPrimaryImage?: string;
      existingLogo?: string;
      price?: string;
      trialCancelled?: boolean;
      cardLastFour?: string;
      cardBrand?: string;
      showOnlineMembers?: string;
    },
    @UploadedFiles() files?: { image?: any[]; logo?: any[]; galleryImages?: any[] },
  ) {
    const userId = req.user.userId;
    let imagePath: string | null | undefined = undefined;
    let logoPath: string | null | undefined = undefined;
    
    if (files?.image?.[0]) {
      // New image uploaded
      imagePath = `/uploads/communities/${files.image[0].filename}`;
    } else if (body.existingPrimaryImage) {
      // Keep existing primary image (don't change it)
      imagePath = body.existingPrimaryImage;
    } else if (body.removeImage === 'true') {
      // Remove image
      imagePath = null;
    }
    
    if (files?.logo?.[0]) {
      // New logo uploaded
      logoPath = `/uploads/communities/${files.logo[0].filename}`;
    } else if (body.existingLogo) {
      // Keep existing logo
      logoPath = body.existingLogo;
    } else if (body.removeLogo === 'true') {
      // Remove logo
      logoPath = null;
    }
    
    const newGalleryPaths = files?.galleryImages?.map(f => `/uploads/communities/${f.filename}`) || [];
    const existingGallery = body.existingGalleryImages ? JSON.parse(body.existingGalleryImages) : [];
    const galleryImages = [...existingGallery, ...newGalleryPaths];
    
    const galleryVideos = body.existingGalleryVideos ? JSON.parse(body.existingGalleryVideos) : [];
    
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
    @Body() body: { role: 'MANAGER' | 'USER' },
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.communitiesService.updateMemberRole(id, memberId, body.role, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.communitiesService.removeMember(id, memberId, userId);
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
  @Delete(':id/banned/:oderId')
  liftBan(@Param('id') id: string, @Param('oderId') oderId: string, @Req() req) {
    const userId = req.user.userId;
    return this.communitiesService.liftBan(id, oderId, userId);
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
    @Body() body: { rules: string[] },
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.communitiesService.updateRules(id, userId, body.rules);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/slug')
  updateSlug(
    @Param('id') id: string,
    @Body() body: { slug: string },
  ) {
    return this.communitiesService.updateSlug(id, body.slug);
  }
}
