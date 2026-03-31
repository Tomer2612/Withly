import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EventsService } from './events.service';
import { RsvpStatus } from '@prisma/client';
import { PrismaService } from '../users/prisma.service';
import { StorageService } from '../common/storage.service';

// Image file filter - only allow image files
const imageFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException('אפשר להעלות רק קבצי תמונה'), false);
  }
  cb(null, true);
};

const storage = memoryStorage();

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // Create event
  @UseGuards(AuthGuard('jwt'))
  @Post('community/:communityId')
  @UseInterceptors(
    FileInterceptor('coverImage', {
      storage,
      fileFilter: imageFileFilter,
    }),
  )
  async create(
    @Param('communityId') communityId: string,
    @Req() req,
    @Body() body: {
      title: string;
      description?: string;
      date: string;
      endDate?: string;
      duration?: string;
      timezone?: string;
      isRecurring?: string;
      recurringType?: string;
      locationType?: string;
      locationName?: string;
      locationUrl?: string;
      category?: string;
      capacity?: string;
      sendReminders?: string;
      reminderDays?: string;
      attendeeType?: string;
    },
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    
    return this.eventsService.create(communityId, userId, {
      title: body.title,
      description: body.description,
      coverImage: coverImage ? await this.storageService.uploadFile(coverImage, 'events') : undefined,
      date: new Date(body.date),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      duration: body.duration ? parseInt(body.duration) : undefined,
      timezone: body.timezone || 'Asia/Jerusalem',
      isRecurring: body.isRecurring === 'true',
      recurringType: body.recurringType,
      locationType: body.locationType || 'online',
      locationName: body.locationName,
      locationUrl: body.locationUrl,
      category: body.category,
      capacity: body.capacity ? parseInt(body.capacity) : undefined,
      sendReminders: body.sendReminders !== 'false',
      reminderDays: body.reminderDays ? parseInt(body.reminderDays) : 1,
      attendeeType: body.attendeeType || 'all',
    });
  }

  // Get all events for community
  @Get('community/:communityId')
  async findByCommunity(
    @Param('communityId') communityId: string,
    @Req() req,
  ) {
    const userId = req.user?.userId;
    return this.eventsService.findByCommunity(communityId, userId);
  }

  // Get upcoming events for community (for sidebar widget)
  @Get('community/:communityId/upcoming')
  async findUpcoming(
    @Param('communityId') communityId: string,
    @Query('limit') limit: string,
    @Req() req,
  ) {
    const userId = req.user?.userId;
    return this.eventsService.findUpcoming(communityId, limit ? parseInt(limit) : 5, userId);
  }

  // Get events for specific month (for calendar view)
  @Get('community/:communityId/calendar')
  async getEventsForMonth(
    @Param('communityId') communityId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Req() req,
  ) {
    // Extract userId from JWT token if present (without requiring auth)
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.sub || decoded.userId;
      } catch (e) {
        // Token invalid or expired, continue without user
      }
    }
    
    // Check if user is manager
    let isManager = false;
    if (userId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId } },
      });
      isManager = membership?.role === 'OWNER' || membership?.role === 'MANAGER';
    }
    
    return this.eventsService.getEventsForMonth(
      communityId,
      parseInt(year),
      parseInt(month),
      userId,
      isManager,
    );
  }

  // Get single event
  @Get(':eventId')
  async findOne(@Param('eventId') eventId: string, @Req() req) {
    const userId = req.user?.userId;
    return this.eventsService.findOne(eventId, userId);
  }

  // Update event
  @UseGuards(AuthGuard('jwt'))
  @Put(':eventId')
  @UseInterceptors(
    FileInterceptor('coverImage', {
      storage,
      fileFilter: imageFileFilter,
    }),
  )
  async update(
    @Param('eventId') eventId: string,
    @Req() req,
    @Body() body: any,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    
    const data: any = { ...body };
    if (coverImage) {
      data.coverImage = await this.storageService.uploadFile(coverImage, 'events');
    }
    if (body.date) data.date = new Date(body.date);
    if (body.endDate) data.endDate = new Date(body.endDate);
    if (body.duration) data.duration = parseInt(body.duration);
    if (body.capacity) data.capacity = parseInt(body.capacity);
    if (body.reminderDays) data.reminderDays = parseInt(body.reminderDays);
    if (body.isRecurring !== undefined) data.isRecurring = body.isRecurring === 'true';
    if (body.sendReminders !== undefined) data.sendReminders = body.sendReminders === 'true';

    return this.eventsService.update(eventId, userId, data);
  }

  // Delete event
  @UseGuards(AuthGuard('jwt'))
  @Delete(':eventId')
  async delete(@Param('eventId') eventId: string, @Req() req) {
    const userId = req.user.userId;
    return this.eventsService.delete(eventId, userId);
  }

  // RSVP to event
  @UseGuards(AuthGuard('jwt'))
  @Post(':eventId/rsvp')
  async rsvp(
    @Param('eventId') eventId: string,
    @Req() req,
    @Body() body: { status: RsvpStatus },
  ) {
    const userId = req.user.userId;
    return this.eventsService.rsvp(eventId, userId, body.status);
  }

  // Remove RSVP
  @UseGuards(AuthGuard('jwt'))
  @Delete(':eventId/rsvp')
  async removeRsvp(@Param('eventId') eventId: string, @Req() req) {
    const userId = req.user.userId;
    return this.eventsService.removeRsvp(eventId, userId);
  }

  // Get event attendees
  @Get(':eventId/attendees')
  async getAttendees(
    @Param('eventId') eventId: string,
    @Query('status') status?: RsvpStatus,
  ) {
    return this.eventsService.getAttendees(eventId, status);
  }
}
