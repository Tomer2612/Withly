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
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EventsService } from './events.service';
import { RsvpStatus } from '@prisma/client';
import { StorageService } from '../common/storage.service';
import { imageFileFilter } from '../common/upload-filters';
import { CreateEventDto, UpdateEventDto, RsvpEventDto } from './dto/events.dto';

const storage = memoryStorage();

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
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
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateEventDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const userId = req.user.userId;

    return this.eventsService.create(communityId, userId, {
      title: body.title,
      description: body.description,
      coverImage: coverImage
        ? await this.storageService.uploadFile(coverImage, 'events')
        : undefined,
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

  // All event reads are for the community's members only. The service also
  // hides attendeeType='managers' events from regular members.

  // Get all events for community
  @UseGuards(AuthGuard('jwt'))
  @Get('community/:communityId')
  async findByCommunity(
    @Param('communityId') communityId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.findByCommunity(communityId, req.user.userId);
  }

  // Get upcoming events for community (for sidebar widget)
  @UseGuards(AuthGuard('jwt'))
  @Get('community/:communityId/upcoming')
  async findUpcoming(
    @Param('communityId') communityId: string,
    @Query('limit') limit: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.findUpcoming(
      communityId,
      req.user.userId,
      Math.min(limit ? parseInt(limit) : 5, 50),
    );
  }

  // Get events for specific month (for calendar view)
  @UseGuards(AuthGuard('jwt'))
  @Get('community/:communityId/calendar')
  async getEventsForMonth(
    @Param('communityId') communityId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.getEventsForMonth(
      communityId,
      parseInt(year),
      parseInt(month),
      req.user.userId,
    );
  }

  // Get single event
  @UseGuards(AuthGuard('jwt'))
  @Get(':eventId')
  async findOne(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.findOne(eventId, req.user.userId);
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
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateEventDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    const userId = req.user.userId;

    // Multipart fields arrive as strings - convert dates/numbers/bools at the boundary.
    const data: Partial<{
      title: string;
      description: string;
      coverImage: string;
      date: Date;
      endDate: Date;
      duration: number;
      timezone: string;
      isRecurring: boolean;
      recurringType: string;
      locationType: string;
      locationName: string;
      locationUrl: string;
      category: string;
      capacity: number;
      sendReminders: boolean;
      reminderDays: number;
      attendeeType: string;
    }> = {};

    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.timezone !== undefined) data.timezone = body.timezone;
    if (body.recurringType !== undefined)
      data.recurringType = body.recurringType;
    if (body.locationType !== undefined) data.locationType = body.locationType;
    if (body.locationName !== undefined) data.locationName = body.locationName;
    if (body.locationUrl !== undefined) data.locationUrl = body.locationUrl;
    if (body.category !== undefined) data.category = body.category;
    if (body.attendeeType !== undefined) data.attendeeType = body.attendeeType;

    if (coverImage)
      data.coverImage = await this.storageService.uploadFile(
        coverImage,
        'events',
      );
    if (body.date) data.date = new Date(body.date);
    if (body.endDate) data.endDate = new Date(body.endDate);
    if (body.duration) data.duration = parseInt(body.duration);
    if (body.capacity) data.capacity = parseInt(body.capacity);
    if (body.reminderDays) data.reminderDays = parseInt(body.reminderDays);
    if (body.isRecurring !== undefined)
      data.isRecurring = body.isRecurring === 'true';
    if (body.sendReminders !== undefined)
      data.sendReminders = body.sendReminders === 'true';

    return this.eventsService.update(eventId, userId, data);
  }

  // Delete event
  @UseGuards(AuthGuard('jwt'))
  @Delete(':eventId')
  async delete(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return this.eventsService.delete(eventId, userId);
  }

  // RSVP to event
  @UseGuards(AuthGuard('jwt'))
  @Post(':eventId/rsvp')
  async rsvp(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: RsvpEventDto,
  ) {
    const userId = req.user.userId;
    return this.eventsService.rsvp(eventId, userId, body.status);
  }

  // Remove RSVP
  @UseGuards(AuthGuard('jwt'))
  @Delete(':eventId/rsvp')
  async removeRsvp(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return this.eventsService.removeRsvp(eventId, userId);
  }

  // Get event attendees — members of the event's community only.
  @UseGuards(AuthGuard('jwt'))
  @Get(':eventId/attendees')
  async getAttendees(
    @Param('eventId') eventId: string,
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: RsvpStatus,
  ) {
    return this.eventsService.getAttendees(eventId, req.user.userId, status);
  }
}
