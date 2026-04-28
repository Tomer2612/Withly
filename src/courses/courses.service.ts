import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CommunitiesService } from '../communities/communities.service';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../common/messages';

@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    private communitiesService: CommunitiesService,
  ) {}

  // Create a new course
  async createCourse(data: {
    title: string;
    description: string;
    image?: string;
    communityId: string;
    authorId: string;
  }) {
    // Resolve slug to actual community ID
    const communityId = await this.communitiesService.resolveId(data.communityId);
    
    // Verify user is owner/manager of community
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        userId_communityId: {
          userId: data.authorId,
          communityId: communityId,
        },
      },
    });

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException(ERROR_MESSAGES.COMMUNITY_NOT_FOUND);
    }

    const isOwner = community.ownerId === data.authorId;
    const isManager = membership?.role === 'MANAGER';

    if (!isOwner && !isManager) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_CREATE_COURSE);
    }

    return this.prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        image: data.image,
        communityId: communityId,
        authorId: data.authorId,
        isPublished: true, // Publish by default
      },
      include: {
        author: {
          select: { id: true, name: true, profileImage: true },
        },
        _count: {
          select: { chapters: true, enrollments: true },
        },
      },
    });
  }

  // Get all courses for a community
  async getCoursesByCommunity(communityIdOrSlug: string, userId?: string) {
    // Resolve slug to actual community ID
    const communityId = await this.communitiesService.resolveId(communityIdOrSlug);
    
    // Build where clause - if user is logged in, show their unpublished courses too
    const whereClause: Prisma.CourseWhereInput = {
      communityId,
    };

    if (userId) {
      whereClause.OR = [
        { isPublished: true },
        { authorId: userId }, // Author can see their unpublished courses
      ];
    } else {
      whereClause.isPublished = true;
    }

    const courses = await this.prisma.course.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, name: true, profileImage: true },
        },
        chapters: {
          include: {
            lessons: true,
          },
          orderBy: { order: 'asc' },
        },
        enrollments: userId ? {
          where: { userId },
          take: 1,
        } : false,
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total lessons and duration for each course
    return courses.map(course => {
      const totalLessons = course.chapters.reduce(
        (sum, chapter) => sum + chapter.lessons.length, 0
      );
      const totalDuration = course.chapters.reduce(
        (sum, chapter) => sum + chapter.lessons.reduce(
          (lessonSum, lesson) => lessonSum + lesson.duration, 0
        ), 0
      );
      const enrollment = course.enrollments?.[0] || null;
      
      return {
        ...course,
        totalLessons,
        totalDuration,
        enrollment,
        chapters: undefined, // Don't send full chapter data in list
      };
    });
  }

  // Get user's enrolled courses (in progress and completed)
  async getUserCourses(userId: string) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            author: {
              select: { id: true, name: true, profileImage: true },
            },
            community: {
              select: { id: true, name: true },
            },
            chapters: {
              include: {
                lessons: true,
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return enrollments.map(enrollment => {
      const totalLessons = enrollment.course.chapters.reduce(
        (sum, chapter) => sum + chapter.lessons.length, 0
      );
      const totalDuration = enrollment.course.chapters.reduce(
        (sum, chapter) => sum + chapter.lessons.reduce(
          (lessonSum, lesson) => lessonSum + lesson.duration, 0
        ), 0
      );

      return {
        ...enrollment,
        course: {
          ...enrollment.course,
          totalLessons,
          totalDuration,
          chapters: undefined,
        },
      };
    });
  }

  // Get course details with chapters and lessons
  async getCourseById(courseId: string, userId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        author: {
          select: { id: true, name: true, profileImage: true },
        },
        community: {
          select: { id: true, name: true, ownerId: true, logo: true },
        },
        chapters: {
          include: {
            lessons: {
              include: {
                quiz: {
                  include: {
                    questions: {
                      include: {
                        options: {
                          orderBy: { order: 'asc' },
                        },
                      },
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(ERROR_MESSAGES.COURSE_NOT_FOUND);
    }

    // Get user's enrollment and lesson progress if logged in
    let enrollment: {
      id: string;
      userId: string;
      courseId: string;
      progress: number;
      enrolledAt: Date;
      completedAt: Date | null;
    } | null = null;
    let lessonProgress: Record<string, boolean> = {};

    if (userId) {
      enrollment = await this.prisma.courseEnrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      const progress = await this.prisma.lessonProgress.findMany({
        where: {
          userId,
          lesson: {
            chapter: {
              courseId,
            },
          },
        },
      });

      lessonProgress = progress.reduce((acc, p) => {
        acc[p.lessonId] = p.completed;
        return acc;
      }, {} as Record<string, boolean>);
    }

    const totalLessons = course.chapters.reduce(
      (sum, chapter) => sum + chapter.lessons.length, 0
    );
    const totalDuration = course.chapters.reduce(
      (sum, chapter) => sum + chapter.lessons.reduce(
        (lessonSum, lesson) => lessonSum + lesson.duration, 0
      ), 0
    );

    return {
      ...course,
      totalLessons,
      totalDuration,
      enrollment,
      lessonProgress,
    };
  }

  // Enroll in a course
  async enrollInCourse(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(ERROR_MESSAGES.COURSE_NOT_FOUND);
    }

    // Use upsert with try-catch to handle race conditions
    try {
      return await this.prisma.courseEnrollment.upsert({
        where: {
          userId_courseId: { userId, courseId },
        },
        update: {}, // No update needed, just return existing
        create: {
          userId,
          courseId,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violation (P2002) - enrollment already exists
      if (error.code === 'P2002') {
        return await this.prisma.courseEnrollment.findUnique({
          where: {
            userId_courseId: { userId, courseId },
          },
        });
      }
      throw error;
    }
  }

  // Unenroll from a course
  async unenrollFromCourse(courseId: string, userId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(ERROR_MESSAGES.NOT_ENROLLED_IN_COURSE);
    }

    // Delete lesson progress for this user and course
    await this.prisma.lessonProgress.deleteMany({
      where: {
        userId,
        lesson: {
          chapter: {
            courseId,
          },
        },
      },
    });

    // Delete enrollment
    return this.prisma.courseEnrollment.delete({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
  }

  // Mark lesson as complete
  async completeLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(ERROR_MESSAGES.LESSON_NOT_FOUND);
    }

    // Create or update lesson progress
    const progress = await this.prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      create: {
        userId,
        lessonId,
        completed: true,
        completedAt: new Date(),
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
    });

    // Update course enrollment progress
    await this.updateCourseProgress(lesson.chapter.courseId, userId);

    return progress;
  }

  // Mark lesson as incomplete (toggle off)
  async uncompleteLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(ERROR_MESSAGES.LESSON_NOT_FOUND);
    }

    // Update lesson progress to incomplete
    const progress = await this.prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      create: {
        userId,
        lessonId,
        completed: false,
        completedAt: null,
      },
      update: {
        completed: false,
        completedAt: null,
      },
    });

    // Update course enrollment progress
    await this.updateCourseProgress(lesson.chapter.courseId, userId);

    return progress;
  }

  // Update overall course progress
  private async updateCourseProgress(courseId: string, userId: string) {
    // Get total lessons in course
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          include: {
            lessons: true,
          },
        },
      },
    });

    if (!course) return;

    const totalLessons = course.chapters.reduce(
      (sum, chapter) => sum + chapter.lessons.length, 0
    );

    if (totalLessons === 0) return;

    // Get completed lessons count
    const completedCount = await this.prisma.lessonProgress.count({
      where: {
        userId,
        completed: true,
        lesson: {
          chapter: {
            courseId,
          },
        },
      },
    });

    const progress = Math.round((completedCount / totalLessons) * 100);
    const isComplete = progress === 100;

    await this.prisma.courseEnrollment.update({
      where: {
        userId_courseId: { userId, courseId },
      },
      data: {
        progress,
        completedAt: isComplete ? new Date() : null,
      },
    });
  }

  // Add chapter to course
  async addChapter(courseId: string, title: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(ERROR_MESSAGES.COURSE_NOT_FOUND);
    }

    if (course.authorId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_EDIT_COURSE);
    }

    // Get max order
    const lastChapter = await this.prisma.chapter.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });

    const order = (lastChapter?.order ?? -1) + 1;

    return this.prisma.chapter.create({
      data: {
        title,
        order,
        courseId,
      },
      include: {
        lessons: true,
      },
    });
  }

  // Add lesson to chapter
  async addLesson(chapterId: string, data: {
    title: string;
    content?: string;
    videoUrl?: string;
    duration?: number;
    lessonType?: string;
    images?: string[];
    files?: any[];
    links?: string[];
    contentOrder?: string[];
    quiz?: {
      questions: {
        question: string;
        questionType: string;
        order: number;
        options: {
          text: string;
          isCorrect: boolean;
          order: number;
        }[];
      }[];
    };
  }, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { course: true },
    });

    if (!chapter) {
      throw new NotFoundException(ERROR_MESSAGES.CHAPTER_NOT_FOUND);
    }

    if (chapter.course.authorId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_EDIT_COURSE);
    }

    // Get max order
    const lastLesson = await this.prisma.lesson.findFirst({
      where: { chapterId },
      orderBy: { order: 'desc' },
    });

    const order = (lastLesson?.order ?? -1) + 1;

    const lesson = await this.prisma.lesson.create({
      data: {
        title: data.title,
        content: data.content,
        videoUrl: data.videoUrl,
        duration: data.duration || 0,
        order,
        chapterId,
        lessonType: data.lessonType || 'content',
        images: data.images || [],
        files: data.files || [],
        links: data.links || [],
        contentOrder: data.contentOrder || ['video', 'text', 'links', 'images'],
        ...(data.quiz && data.lessonType === 'quiz' ? {
          quiz: {
            create: {
              questions: {
                create: data.quiz.questions.map((q, qIndex) => ({
                  question: q.question,
                  questionType: q.questionType,
                  order: q.order ?? qIndex,
                  options: {
                    create: q.options.map((o, oIndex) => ({
                      text: o.text,
                      isCorrect: o.isCorrect,
                      order: o.order ?? oIndex,
                    })),
                  },
                })),
              },
            },
          },
        } : {}),
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    // Update course total duration
    await this.updateCourseDuration(chapter.courseId);

    return lesson;
  }

  // Update course total duration
  private async updateCourseDuration(courseId: string) {
    const chapters = await this.prisma.chapter.findMany({
      where: { courseId },
      include: { lessons: true },
    });

    const totalDuration = chapters.reduce(
      (sum, chapter) => sum + chapter.lessons.reduce(
        (lessonSum, lesson) => lessonSum + lesson.duration, 0
      ), 0
    );

    await this.prisma.course.update({
      where: { id: courseId },
      data: { duration: totalDuration },
    });
  }

  // Update course
  async updateCourse(courseId: string, data: {
    title?: string;
    description?: string;
    image?: string;
    isPublished?: boolean;
  }, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(ERROR_MESSAGES.COURSE_NOT_FOUND);
    }

    // Only the course author can edit
    if (course.authorId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_EDIT_COURSE);
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data,
      include: {
        author: {
          select: { id: true, name: true, profileImage: true },
        },
        chapters: {
          include: {
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  // Update chapter
  async updateChapter(chapterId: string, data: {
    title?: string;
    order?: number;
  }, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { course: true },
    });

    if (!chapter) {
      throw new NotFoundException(ERROR_MESSAGES.CHAPTER_NOT_FOUND);
    }

    if (chapter.course.authorId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_EDIT_COURSE);
    }

    return this.prisma.chapter.update({
      where: { id: chapterId },
      data,
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  // Update lesson
  async updateLesson(lessonId: string, data: {
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
    quiz?: {
      questions: {
        id?: string;
        question: string;
        questionType: string;
        order: number;
        options: {
          id?: string;
          text: string;
          isCorrect: boolean;
          order: number;
        }[];
      }[];
    };
  }, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: { course: true },
        },
        quiz: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException(ERROR_MESSAGES.LESSON_NOT_FOUND);
    }

    if (lesson.chapter.course.authorId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_EDIT_COURSE);
    }

    // Handle quiz update separately
    if (data.quiz && data.lessonType === 'quiz') {
      // Delete existing quiz if exists
      if (lesson.quiz) {
        await this.prisma.lessonQuiz.delete({
          where: { id: lesson.quiz.id },
        });
      }
      
      // Create new quiz
      await this.prisma.lessonQuiz.create({
        data: {
          lessonId,
          questions: {
            create: data.quiz.questions.map((q, qIndex) => ({
              question: q.question,
              questionType: q.questionType,
              order: q.order ?? qIndex,
              options: {
                create: q.options.map((o, oIndex) => ({
                  text: o.text,
                  isCorrect: o.isCorrect,
                  order: o.order ?? oIndex,
                })),
              },
            })),
          },
        },
      });
    } else if (data.lessonType === 'content' && lesson.quiz) {
      // If changing from quiz to content, delete the quiz
      await this.prisma.lessonQuiz.delete({
        where: { id: lesson.quiz.id },
      });
    }

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: data.title,
        content: data.content,
        videoUrl: data.videoUrl,
        duration: data.duration,
        order: data.order,
        lessonType: data.lessonType,
        images: data.images,
        files: data.files,
        links: data.links,
        contentOrder: data.contentOrder,
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    // Update course duration if lesson duration changed
    if (data.duration !== undefined) {
      await this.updateCourseDuration(lesson.chapter.courseId);
    }

    return updated;
  }

  // Delete course
  async deleteCourse(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { community: true },
    });

    if (!course) {
      throw new NotFoundException(ERROR_MESSAGES.COURSE_NOT_FOUND);
    }

    const isOwner = course.community.ownerId === userId;
    const isAuthor = course.authorId === userId;

    if (!isOwner && !isAuthor) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_DELETE_COURSE);
    }

    await this.prisma.course.delete({
      where: { id: courseId },
    });

    return { message: SUCCESS_MESSAGES.COURSE_DELETED };
  }

  // Delete chapter
  async deleteChapter(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { course: true },
    });

    if (!chapter) {
      throw new NotFoundException(ERROR_MESSAGES.CHAPTER_NOT_FOUND);
    }

    if (chapter.course.authorId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_EDIT_COURSE);
    }

    await this.prisma.chapter.delete({
      where: { id: chapterId },
    });

    return { message: SUCCESS_MESSAGES.CHAPTER_DELETED };
  }

  // Delete lesson
  async deleteLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: { course: true },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(ERROR_MESSAGES.LESSON_NOT_FOUND);
    }

    if (lesson.chapter.course.authorId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.NO_PERMISSION_EDIT_COURSE);
    }

    await this.prisma.lesson.delete({
      where: { id: lessonId },
    });

    // Update course duration
    await this.updateCourseDuration(lesson.chapter.courseId);

    return { message: SUCCESS_MESSAGES.LESSON_DELETED };
  }

  // Get lesson by ID
  async getLessonById(lessonId: string, userId?: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: {
          include: {
            course: {
              select: { id: true, title: true, authorId: true },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(ERROR_MESSAGES.LESSON_NOT_FOUND);
    }

    let progress: {
      id: string;
      lessonId: string;
      userId: string;
      completed: boolean;
      completedAt: Date | null;
    } | null = null;
    if (userId) {
      progress = await this.prisma.lessonProgress.findUnique({
        where: {
          userId_lessonId: { userId, lessonId },
        },
      });
    }

    return {
      ...lesson,
      isCompleted: progress?.completed || false,
    };
  }
}
