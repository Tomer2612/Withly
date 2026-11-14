import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CoursesService } from './courses.service';
import { StorageService } from '../common/storage.service';
import { imageFileFilter, videoFileFilter } from '../common/upload-filters';
import {
  CreateCourseDto,
  UpdateCourseDto,
  AddChapterDto,
  UpdateChapterDto,
  AddLessonDto,
  UpdateLessonDto,
  CheckQuizAnswerDto,
} from './dto/courses.dto';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const storage = memoryStorage();

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
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCourseDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.coursesService.createCourse({
      ...body,
      image: file
        ? await this.storageService.uploadFile(file, 'courses')
        : undefined,
      authorId: req.user.userId,
    });
  }

  // Get courses for a community — members only.
  @UseGuards(AuthGuard('jwt'))
  @Get('community/:communityId')
  async getCoursesByCommunity(
    @Param('communityId') communityId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.getCoursesByCommunity(
      communityId,
      req.user.userId,
    );
  }

  // Get user's enrolled courses
  @UseGuards(AuthGuard('jwt'))
  @Get('my-courses')
  async getUserCourses(@Req() req: AuthenticatedRequest) {
    return this.coursesService.getUserCourses(req.user.userId);
  }

  // Get course by ID — members of the course's community only.
  @UseGuards(AuthGuard('jwt'))
  @Get(':courseId')
  async getCourseById(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.getCourseById(courseId, req.user.userId);
  }

  // Enroll in a course
  @UseGuards(AuthGuard('jwt'))
  @Post(':courseId/enroll')
  async enrollInCourse(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.enrollInCourse(courseId, req.user.userId);
  }

  // Unenroll from a course
  @UseGuards(AuthGuard('jwt'))
  @Delete(':courseId/enroll')
  async unenrollFromCourse(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
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
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateCourseDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updateData: {
      title?: string;
      description?: string;
      isPublished?: boolean;
      image?: string;
    } = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.isPublished !== undefined) {
      updateData.isPublished =
        body.isPublished === true || body.isPublished === 'true';
    }
    if (file)
      updateData.image = await this.storageService.uploadFile(file, 'courses');

    return this.coursesService.updateCourse(
      courseId,
      updateData,
      req.user.userId,
    );
  }

  // Delete course
  @UseGuards(AuthGuard('jwt'))
  @Delete(':courseId')
  async deleteCourse(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.deleteCourse(courseId, req.user.userId);
  }

  // Add chapter to course
  @UseGuards(AuthGuard('jwt'))
  @Post(':courseId/chapters')
  async addChapter(
    @Param('courseId') courseId: string,
    @Body() body: AddChapterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.addChapter(
      courseId,
      body.title,
      req.user.userId,
    );
  }

  // Update chapter
  @UseGuards(AuthGuard('jwt'))
  @Patch('chapters/:chapterId')
  async updateChapter(
    @Param('chapterId') chapterId: string,
    @Body() body: UpdateChapterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.updateChapter(chapterId, body, req.user.userId);
  }

  // Delete chapter
  @UseGuards(AuthGuard('jwt'))
  @Delete('chapters/:chapterId')
  async deleteChapter(
    @Param('chapterId') chapterId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.deleteChapter(chapterId, req.user.userId);
  }

  // Add lesson to chapter
  @UseGuards(AuthGuard('jwt'))
  @Post('chapters/:chapterId/lessons')
  async addLesson(
    @Param('chapterId') chapterId: string,
    @Body() body: AddLessonDto,
    @Req() req: AuthenticatedRequest,
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
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.coursesService.assertCanUploadLessonMedia(req.user.userId);
    if (!file) {
      throw new BadRequestException('No file uploaded');
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
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.coursesService.assertCanUploadLessonMedia(req.user.userId);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const url = await this.storageService.uploadFile(file, 'lessons');
    return { url };
  }

  // Check one quiz answer on the server (learners no longer receive the
  // answer key). Members of the lesson's community only.
  @UseGuards(AuthGuard('jwt'))
  @Post('lessons/:lessonId/quiz/check')
  async checkQuizAnswer(
    @Param('lessonId') lessonId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: CheckQuizAnswerDto,
  ) {
    return this.coursesService.checkQuizAnswer(
      lessonId,
      body.questionId,
      body.optionIds,
      req.user.userId,
    );
  }

  // Get lesson by ID — members of the lesson's community only.
  @UseGuards(AuthGuard('jwt'))
  @Get('lessons/:lessonId')
  async getLessonById(
    @Param('lessonId') lessonId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.getLessonById(lessonId, req.user.userId);
  }

  // Update lesson
  @UseGuards(AuthGuard('jwt'))
  @Patch('lessons/:lessonId')
  async updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() body: UpdateLessonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.updateLesson(lessonId, body, req.user.userId);
  }

  // Delete lesson
  @UseGuards(AuthGuard('jwt'))
  @Delete('lessons/:lessonId')
  async deleteLesson(
    @Param('lessonId') lessonId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.deleteLesson(lessonId, req.user.userId);
  }

  // Mark lesson as complete
  @UseGuards(AuthGuard('jwt'))
  @Post('lessons/:lessonId/complete')
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.completeLesson(lessonId, req.user.userId);
  }

  // Mark lesson as incomplete
  @UseGuards(AuthGuard('jwt'))
  @Delete('lessons/:lessonId/complete')
  async uncompleteLesson(
    @Param('lessonId') lessonId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.uncompleteLesson(lessonId, req.user.userId);
  }
}
