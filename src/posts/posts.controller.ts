import { Controller, Post, Body, Param, UseGuards, Req, Get, Delete, Patch, Query, UseInterceptors, UploadedFiles, Res, StreamableFile, BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { PostsService } from './posts.service';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../common/storage.service';

const storage = memoryStorage();

// File filter to determine file type
const getFileType = (mimetype: string): 'image' | 'video' | 'file' => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'file';
};

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

// Only allow images, videos, and common document types
const postFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-powerpoint' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.mimetype === 'text/plain' ||
    file.mimetype === 'application/zip' ||
    file.mimetype === 'application/x-rar-compressed'
  ) {
    cb(null, true);
  } else {
    cb(new BadRequestException('סוג קובץ לא נתמך'), false);
  }
};

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  // Get posts by community - must come before :postId routes
  @Get('community/:communityId')
  getPosts(
    @Param('communityId') communityId: string,
    @Query('userId') userId?: string
  ) {
    return this.postsService.findByCommunity(communityId, userId);
  }

  // Create post in community
  @UseGuards(AuthGuard('jwt'))
  @Post('community/:communityId')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 posts per minute
  @UseInterceptors(FilesInterceptor('files', 15, { storage, fileFilter: postFileFilter, limits: { fileSize: MAX_VIDEO_SIZE } }))
  async createPost(
    @Param('communityId') communityId: string,
    @Req() req,
    @Body() body: { content: string; title?: string; links?: string; category?: string; videoUrls?: string },
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    const userId = req.user.userId;
    
    const images: string[] = [];
    const uploadedFiles: { url: string; name: string }[] = [];
    const videos: string[] = [];
    
    if (files && files.length > 0) {
      for (const file of files) {
        const fileType = getFileType(file.mimetype);
        // Decode Hebrew/non-ASCII filenames properly
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        if (fileType === 'image' && images.length < 6) {
          const url = await this.storageService.uploadFile(file, 'posts');
          images.push(url);
        } else if (fileType === 'video' && videos.length < 3) {
          const url = await this.storageService.uploadFile(file, 'posts');
          videos.push(url);
        } else if (fileType === 'file' && uploadedFiles.length < 6) {
          const url = await this.storageService.uploadFile(file, 'posts');
          uploadedFiles.push({ url, name: originalName });
        }
      }
    }
    
    // Parse external video URLs (YouTube, Vimeo, Dailymotion)
    if (body.videoUrls) {
      try {
        const externalVideos = JSON.parse(body.videoUrls);
        if (Array.isArray(externalVideos)) {
          videos.push(...externalVideos.slice(0, 3 - videos.length));
        }
      } catch {}
    }
    
    // Parse links from JSON string
    let links: string[] = [];
    if (body.links) {
      try {
        links = JSON.parse(body.links);
        if (Array.isArray(links)) {
          links = links.slice(0, 10); // Limit to 10 links
        } else {
          links = [];
        }
      } catch {
        links = [];
      }
    }
    
    const post = await this.postsService.create(
      body.content, 
      userId, 
      communityId, 
      body.title, 
      images.length > 0 ? images : undefined,
      uploadedFiles.length > 0 ? uploadedFiles : undefined,
      links.length > 0 ? links : undefined,
      body.category,
      videos.length > 0 ? videos : undefined
    );
    
    // Notify followers about new post
    await this.notificationsService.notifyNewPost(userId, post.id, communityId);
    
    return post;
  }

  // Delete a comment - specific route before generic :postId
  @UseGuards(AuthGuard('jwt'))
  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string, @Req() req) {
    const userId = req.user.userId;
    return this.postsService.deleteComment(commentId, userId);
  }

  // Edit a comment
  @UseGuards(AuthGuard('jwt'))
  @Patch('comments/:commentId')
  editComment(
    @Param('commentId') commentId: string,
    @Req() req,
    @Body() body: { content: string }
  ) {
    const userId = req.user.userId;
    return this.postsService.editComment(commentId, userId, body.content);
  }

  // Update a post
  @UseGuards(AuthGuard('jwt'))
  @Patch(':postId')
  @UseInterceptors(FilesInterceptor('files', 15, { storage, fileFilter: postFileFilter, limits: { fileSize: MAX_VIDEO_SIZE } }))
  async updatePost(
    @Param('postId') postId: string,
    @Req() req,
    @Body() body: { 
      content: string; 
      title?: string; 
      links?: string;
      imagesToRemove?: string;
      filesToRemove?: string;
      linksToRemove?: string;
      videosToRemove?: string;
      videoUrls?: string;
      pollQuestion?: string;
      pollOptions?: string;
      newPollQuestion?: string;
      newPollOptions?: string;
    },
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    const userId = req.user.userId;
    
    const newImages: string[] = [];
    const newFiles: { url: string; name: string }[] = [];
    const newVideos: string[] = [];
    
    if (files && files.length > 0) {
      for (const file of files) {
        const fileType = getFileType(file.mimetype);
        // Decode Hebrew/non-ASCII filenames properly
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        if (fileType === 'image' && newImages.length < 6) {
          const url = await this.storageService.uploadFile(file, 'posts');
          newImages.push(url);
        } else if (fileType === 'video' && newVideos.length < 3) {
          const url = await this.storageService.uploadFile(file, 'posts');
          newVideos.push(url);
        } else if (fileType === 'file' && newFiles.length < 6) {
          const url = await this.storageService.uploadFile(file, 'posts');
          newFiles.push({ url, name: originalName });
        }
      }
    }
    
    // Parse external video URLs
    if (body.videoUrls) {
      try {
        const externalVideos = JSON.parse(body.videoUrls);
        if (Array.isArray(externalVideos)) {
          newVideos.push(...externalVideos.slice(0, 3 - newVideos.length));
        }
      } catch {}
    }
    
    // Parse arrays from JSON strings
    let links: string[] | undefined;
    let imagesToRemove: string[] | undefined;
    let filesToRemove: string[] | undefined;
    let linksToRemove: string[] | undefined;
    let videosToRemove: string[] | undefined;
    let pollOptions: { id: string; text: string }[] | undefined;
    let newPollOptions: string[] | undefined;
    
    try {
      if (body.links) links = JSON.parse(body.links);
      if (body.imagesToRemove) imagesToRemove = JSON.parse(body.imagesToRemove);
      if (body.filesToRemove) filesToRemove = JSON.parse(body.filesToRemove);
      if (body.linksToRemove) linksToRemove = JSON.parse(body.linksToRemove);
      if (body.videosToRemove) videosToRemove = JSON.parse(body.videosToRemove);
      if (body.pollOptions) pollOptions = JSON.parse(body.pollOptions);
      if (body.newPollOptions) newPollOptions = JSON.parse(body.newPollOptions);
    } catch {
      // Ignore parse errors
    }
    
    return this.postsService.update(
      postId, 
      body.content, 
      userId, 
      body.title, 
      newImages.length > 0 ? newImages : undefined,
      newFiles.length > 0 ? newFiles : undefined,
      links,
      imagesToRemove,
      filesToRemove,
      linksToRemove,
      body.pollQuestion,
      pollOptions,
      body.newPollQuestion,
      newPollOptions,
      newVideos.length > 0 ? newVideos : undefined,
      videosToRemove
    );
  }

  // Delete a post
  @UseGuards(AuthGuard('jwt'))
  @Delete(':postId')
  deletePost(@Param('postId') postId: string, @Req() req) {
    const userId = req.user.userId;
    return this.postsService.delete(postId, userId);
  }

  // Like/Unlike toggle
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/like')
  async toggleLike(@Param('postId') postId: string, @Req() req) {
    const userId = req.user.userId;
    const result = await this.postsService.toggleLike(postId, userId);
    
    // Send notification if liked (not unliked)
    if (result.liked && result.post) {
      await this.notificationsService.notifyLike(
        result.post.authorId,
        userId,
        postId,
        result.post.communityId,
      );
    }
    
    return result;
  }

  // Save/Unsave toggle
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/save')
  toggleSave(@Param('postId') postId: string, @Req() req) {
    const userId = req.user.userId;
    return this.postsService.toggleSave(postId, userId);
  }

  // Pin/Unpin a post (owner/manager only)
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/pin')
  togglePin(@Param('postId') postId: string, @Req() req) {
    const userId = req.user.userId;
    return this.postsService.togglePin(postId, userId);
  }

  // Get comments for a post
  @Get(':postId/comments')
  getComments(@Param('postId') postId: string) {
    return this.postsService.getComments(postId);
  }

  // Create a comment
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/comments')
  async createComment(
    @Param('postId') postId: string,
    @Req() req,
    @Body() body: { content: string }
  ) {
    const userId = req.user.userId;
    const comment = await this.postsService.createComment(postId, userId, body.content);
    
    // Send notification to post author
    if (comment.post) {
      await this.notificationsService.notifyComment(
        comment.post.authorId,
        userId,
        postId,
        comment.post.communityId,
        comment.id,
      );
      
      // Process @mentions in the comment
      await this.notificationsService.processMentions(
        body.content,
        userId,
        postId,
        comment.post.communityId,
        comment.id,
      );
    }
    
    return comment;
  }

  // Get link preview metadata
  @SkipThrottle()
  @Get('link-preview')
  async getLinkPreview(@Query('url') url: string) {
    return this.postsService.getLinkPreview(url);
  }

  // Create a poll for a post
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/poll')
  createPoll(
    @Param('postId') postId: string,
    @Req() req,
    @Body() body: { question: string; options: string[]; expiresAt?: string }
  ) {
    const userId = req.user.userId;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    return this.postsService.createPoll(postId, userId, body.question, body.options, expiresAt);
  }

  // Vote on a poll
  @UseGuards(AuthGuard('jwt'))
  @Post('polls/:pollId/vote')
  votePoll(
    @Param('pollId') pollId: string,
    @Req() req,
    @Body() body: { optionId: string }
  ) {
    const userId = req.user.userId;
    return this.postsService.votePoll(pollId, body.optionId, userId);
  }

  // Remove vote from a poll
  @UseGuards(AuthGuard('jwt'))
  @Delete('polls/:pollId/vote')
  removeVote(
    @Param('pollId') pollId: string,
    @Req() req
  ) {
    const userId = req.user.userId;
    return this.postsService.removeVote(pollId, userId);
  }

  // Delete a poll from a post
  @UseGuards(AuthGuard('jwt'))
  @Delete('polls/:pollId')
  deletePoll(
    @Param('pollId') pollId: string,
    @Req() req
  ) {
    const userId = req.user.userId;
    return this.postsService.deletePoll(pollId, userId);
  }
}
