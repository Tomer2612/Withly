import { Controller, Post, Body, Param, UseGuards, Req, Get, Delete, Patch, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { parseIdTextArray, parseStringArray } from '../common/parse-json';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { PostsService } from './posts.service';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../common/storage.service';
import { postContentFileFilter } from '../common/upload-filters';
import { FileAttachment } from '../common/file-attachment.type';
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  EditCommentDto,
  CreatePollDto,
  VotePollDto,
} from './dto/posts.dto';

const storage = memoryStorage();

// Used when fanning out a single multipart upload across the post's
// images / videos / files arrays.
const getFileType = (mimetype: string): 'image' | 'video' | 'file' => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'file';
};

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  // Get posts by community - must come before :postId routes.
  // Members only. The viewer comes from the login cookie; a client-supplied
  // ?userId= is ignored (it used to let anyone read another user's likes,
  // saves and poll votes).
  @UseGuards(AuthGuard('jwt'))
  @Get('community/:communityId')
  getPosts(
    @Param('communityId') communityId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.findByCommunity(communityId, req.user.userId);
  }

  // Create post in community
  @UseGuards(AuthGuard('jwt'))
  @Post('community/:communityId')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 posts per minute
  @UseInterceptors(FilesInterceptor('files', 15, { storage, fileFilter: postContentFileFilter, limits: { fileSize: MAX_VIDEO_SIZE } }))
  async createPost(
    @Param('communityId') communityId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    const userId = req.user.userId;

    // Members only — checked before any upload so a non-member's
    // attachments never reach storage.
    await this.postsService.assertCanPost(communityId, userId);

    const images: string[] = [];
    const uploadedFiles: FileAttachment[] = [];
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
    const externalVideos = parseStringArray(body.videoUrls) ?? [];
    videos.push(...externalVideos.slice(0, 3 - videos.length));

    // Parse links from JSON string (max 10)
    const links: string[] = (parseStringArray(body.links) ?? []).slice(0, 10);
    
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
    
    // Notify followers about new post. Fire-and-forget: the post is already
    // saved, and a 10k-follower fan-out shouldn't hold the response.
    this.notificationsService.notifyNewPost(userId, post.id, communityId).catch(() => {});

    return post;
  }

  // Delete a comment - specific route before generic :postId
  @UseGuards(AuthGuard('jwt'))
  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.postsService.deleteComment(commentId, userId);
  }

  // Edit a comment
  @UseGuards(AuthGuard('jwt'))
  @Patch('comments/:commentId')
  editComment(
    @Param('commentId') commentId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: EditCommentDto,
  ) {
    const userId = req.user.userId;
    return this.postsService.editComment(commentId, userId, body.content);
  }

  // Update a post
  @UseGuards(AuthGuard('jwt'))
  @Patch(':postId')
  @UseInterceptors(FilesInterceptor('files', 15, { storage, fileFilter: postContentFileFilter, limits: { fileSize: MAX_VIDEO_SIZE } }))
  async updatePost(
    @Param('postId') postId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdatePostDto,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    const userId = req.user.userId;
    
    const newImages: string[] = [];
    const newFiles: FileAttachment[] = [];
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
    const externalVideos = parseStringArray(body.videoUrls) ?? [];
    newVideos.push(...externalVideos.slice(0, 3 - newVideos.length));

    // Parse arrays from JSON strings. Each field independently; a malformed
    // one is treated as "not sent" (undefined = leave as is).
    const links = parseStringArray(body.links);
    const imagesToRemove = parseStringArray(body.imagesToRemove);
    const filesToRemove = parseStringArray(body.filesToRemove);
    const linksToRemove = parseStringArray(body.linksToRemove);
    const videosToRemove = parseStringArray(body.videosToRemove);
    const pollOptions = parseIdTextArray(body.pollOptions);
    const newPollOptions = parseStringArray(body.newPollOptions);
    
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
  deletePost(@Param('postId') postId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.postsService.delete(postId, userId);
  }

  // Like/Unlike toggle
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/like')
  async toggleLike(@Param('postId') postId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const result = await this.postsService.toggleLike(postId, userId);
    
    // Send notification if liked (not unliked). Skip when the post author
    // has been anonymized (Phase 5 Mission 2 — deleted account) — there's
    // nobody to notify.
    if (result.liked && result.post && result.post.authorId) {
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
  toggleSave(@Param('postId') postId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.postsService.toggleSave(postId, userId);
  }

  // Pin/Unpin a post (owner/manager only)
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/pin')
  togglePin(@Param('postId') postId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.postsService.togglePin(postId, userId);
  }

  // Get comments for a post — members of the post's community only.
  @UseGuards(AuthGuard('jwt'))
  @Get(':postId/comments')
  getComments(@Param('postId') postId: string, @Req() req: AuthenticatedRequest) {
    return this.postsService.getComments(postId, req.user.userId);
  }

  // Create a comment
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/comments')
  async createComment(
    @Param('postId') postId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCommentDto,
  ) {
    const userId = req.user.userId;
    const comment = await this.postsService.createComment(postId, userId, body.content);
    
    // Send notification to post author. Skip when anonymized (Phase 5
    // Mission 2 — deleted account).
    if (comment.post && comment.post.authorId) {
      await this.notificationsService.notifyComment(
        comment.post.authorId,
        userId,
        postId,
        comment.post.communityId,
      );

      // Process @mentions in the comment. Fire-and-forget for the same
      // reason as notifyNewPost above.
      this.notificationsService.processMentions(
        body.content,
        userId,
        postId,
        comment.post.communityId,
      ).catch(() => {});
    }
    
    return comment;
  }

  // Get link preview metadata. Login required: the only caller is the
  // members-only feed, and an open endpoint would let anyone use the server
  // to fetch pages. Not throttled because the feed asks for several at once.
  @UseGuards(AuthGuard('jwt'))
  @SkipThrottle()
  @Get('link-preview')
  async getLinkPreview(@Query('url') url: string) {
    if (typeof url !== 'string' || url.length > 2048) {
      return { url: String(url ?? ''), title: String(url ?? ''), description: null, image: null };
    }
    return this.postsService.getLinkPreview(url);
  }

  // Create a poll for a post
  @UseGuards(AuthGuard('jwt'))
  @Post(':postId/poll')
  createPoll(
    @Param('postId') postId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: CreatePollDto,
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
    @Req() req: AuthenticatedRequest,
    @Body() body: VotePollDto,
  ) {
    const userId = req.user.userId;
    return this.postsService.votePoll(pollId, body.optionId, userId);
  }

  // Remove vote from a poll
  @UseGuards(AuthGuard('jwt'))
  @Delete('polls/:pollId/vote')
  removeVote(
    @Param('pollId') pollId: string,
    @Req() req: AuthenticatedRequest
  ) {
    const userId = req.user.userId;
    return this.postsService.removeVote(pollId, userId);
  }

  // Delete a poll from a post
  @UseGuards(AuthGuard('jwt'))
  @Delete('polls/:pollId')
  deletePoll(
    @Param('pollId') pollId: string,
    @Req() req: AuthenticatedRequest
  ) {
    const userId = req.user.userId;
    return this.postsService.deletePoll(pollId, userId);
  }
}
