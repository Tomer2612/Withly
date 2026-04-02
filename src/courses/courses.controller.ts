import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as jwt from 'jsonwebtoken';
import { CoursesService } from './courses.service';
import { StorageService } from '../common/storage.service';

// Image file filter - only allow image files
const imageFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException('אפשר להעלות רק קבצי תמונה'), false);
  }
  cb(null, true);
};

const videoFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (!file.mimetype.startsWith('video/')) {
    return cb(new BadRequestException('אפשר להעלות רק קבצי וידאו'), false);
  }
  cb(null, true);
};

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const storage = memoryStorage();

// Helper to extract userId from optional JWT token
function getUserIdFromToken(authHeader?: string): string | undefined {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret') as any;
    return decoded.sub || decoded.userId;
  } catch {
    return undefined;
  }
}

@Controller('courses')
export class CoursesController {
  constructor(
    private coursesService: CoursesService,
    private storageService: StorageService,
  ) {}

  // Create a new course
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage,
      fileFilter: imageFileFilter,
    }),
  )
  async createCourse(
    @Req() req,
    @Body() body: { title: string; description: string; communityId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.coursesService.createCourse({
      ...body,
      image: file ? await this.storageService.uploadFile(file, 'courses') : undefined,
      authorId: req.user.userId,
    });
  }

  // Get courses for a community
  @Get('community/:communityId')
  async getCoursesByCommunity(
    @Param('communityId') communityId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = getUserIdFromToken(authHeader);
    return this.coursesService.getCoursesByCommunity(communityId, userId);
  }

  // Get user's enrolled courses
  @UseGuards(AuthGuard('jwt'))
  @Get('my-courses')
  async getUserCourses(@Req() req) {
    return this.coursesService.getUserCourses(req.user.userId);
  }

  // Get course by ID
  @Get(':courseId')
  async getCourseById(
    @Param('courseId') courseId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = getUserIdFromToken(authHeader);
    return this.coursesService.getCourseById(courseId, userId);
  }

  // Enroll in a course
  @UseGuards(AuthGuard('jwt'))
  @Post(':courseId/enroll')
  async enrollInCourse(@Param('courseId') courseId: string, @Req() req) {
    return this.coursesService.enrollInCourse(courseId, req.user.userId);
  }

  // Unenroll from a course
  @UseGuards(AuthGuard('jwt'))
  @Delete(':courseId/enroll')
  async unenrollFromCourse(@Param('courseId') courseId: string, @Req() req) {
    return this.coursesService.unenrollFromCourse(courseId, req.user.userId);
  }

  // Update course
  @UseGuards(AuthGuard('jwt'))
  @Patch(':courseId')
  @UseInterceptors(
    FileInterceptor('image', {
      storage,
      fileFilter: imageFileFilter,
    }),
  )
  async updateCourse(
    @Param('courseId') courseId: string,
    @Req() req,
    @Body() body: { title?: string; description?: string; isPublished?: string | boolean },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updateData: { title?: string; description?: string; isPublished?: boolean; image?: string } = {};
    
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished === true || body.isPublished === 'true';
    }
    if (file) updateData.image = await this.storageService.uploadFile(file, 'courses');
    
    return this.coursesService.updateCourse(courseId, updateData, req.user.userId);
  }

  // Delete course
  @UseGuards(AuthGuard('jwt'))
  @Delete(':courseId')
  async deleteCourse(@Param('courseId') courseId: string, @Req() req) {
    return this.coursesService.deleteCourse(courseId, req.user.userId);
  }

  // Add chapter to course
  @UseGuards(AuthGuard('jwt'))
  @Post(':courseId/chapters')
  async addChapter(
    @Param('courseId') courseId: string,
    @Body() body: { title: string },
    @Req() req,
  ) {
    return this.coursesService.addChapter(courseId, body.title, req.user.userId);
  }

  // Update chapter
  @UseGuards(AuthGuard('jwt'))
  @Patch('chapters/:chapterId')
  async updateChapter(
    @Param('chapterId') chapterId: string,
    @Body() body: { title?: string; order?: number },
    @Req() req,
  ) {
    return this.coursesService.updateChapter(chapterId, body, req.user.userId);
  }

  // Delete chapter
  @UseGuards(AuthGuard('jwt'))
  @Delete('chapters/:chapterId')
  async deleteChapter(@Param('chapterId') chapterId: string, @Req() req) {
    return this.coursesService.deleteChapter(chapterId, req.user.userId);
  }

  // Add lesson to chapter
  @UseGuards(AuthGuard('jwt'))
  @Post('chapters/:chapterId/lessons')
  async addLesson(
    @Param('chapterId') chapterId: string,
    @Body() body: { 
      title: string; 
      content?: string; 
      videoUrl?: string; 
      duration?: number;
      lessonType?: string;
      images?: string[];
      files?: any[];
      links?: string[];
      contentOrder?: string[];
      quiz?: any;
    },
    @Req() req,
  ) {
    return this.coursesService.addLesson(chapterId, body, req.user.userId);
  }

  // Upload lesson images
  @UseGuards(AuthGuard('jwt'))
  @Post('lessons/upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage,
      fileFilter: imageFileFilter,
    }),
  )
  async uploadLessonImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const url = await this.storageService.uploadFile(file, 'lessons');
    return { url };
  }

  // Upload lesson video
  @UseGuards(AuthGuard('jwt'))
  @Post('lessons/upload-video')
  @UseInterceptors(
    FileInterceptor('video', {
      storage,
      fileFilter: videoFileFilter,
      limits: { fileSize: MAX_VIDEO_SIZE },
    }),
  )
  async uploadLessonVideo(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const url = await this.storageService.uploadFile(file, 'lessons');
    return { url };
  }

  // Get lesson by ID
  @Get('lessons/:lessonId')
  async getLessonById(
    @Param('lessonId') lessonId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = getUserIdFromToken(authHeader);
    return this.coursesService.getLessonById(lessonId, userId);
  }

  // Update lesson
  @UseGuards(AuthGuard('jwt'))
  @Patch('lessons/:lessonId')
  async updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() body: { 
      title?: string; 
      content?: string; 
      videoUrl?: string; 
      duration?: number; 
      order?: number;
      lessonType?: string;
      images?: string[];
      files?: any[];
      links?: string[];
      contentOrder?: string[];
      quiz?: any;
    },
    @Req() req,
  ) {
    return this.coursesService.updateLesson(lessonId, body, req.user.userId);
  }

  // Delete lesson
  @UseGuards(AuthGuard('jwt'))
  @Delete('lessons/:lessonId')
  async deleteLesson(@Param('lessonId') lessonId: string, @Req() req) {
    return this.coursesService.deleteLesson(lessonId, req.user.userId);
  }

  // Mark lesson as complete
  @UseGuards(AuthGuard('jwt'))
  @Post('lessons/:lessonId/complete')
  async completeLesson(@Param('lessonId') lessonId: string, @Req() req) {
    return this.coursesService.completeLesson(lessonId, req.user.userId);
  }

  // Mark lesson as incomplete
  @UseGuards(AuthGuard('jwt'))
  @Delete('lessons/:lessonId/complete')
  async uncompleteLesson(@Param('lessonId') lessonId: string, @Req() req) {
    return this.coursesService.uncompleteLesson(lessonId, req.user.userId);
  }
}
