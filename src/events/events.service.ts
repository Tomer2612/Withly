import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma, RsvpStatus } from '@prisma/client';
import { CommunitiesService } from '../communities/communities.service';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private communitiesService: CommunitiesService,
  ) {}

  async create(
    communityIdOrSlug: string,
    createdById: string,
    data: {
      title: string;
      description?: string;
      coverImage?: string;
      date: Date;
      endDate?: Date;
      duration?: number;
      timezone?: string;
      isRecurring?: boolean;
      recurringType?: string;
      locationType?: string;
      locationName?: string;
      locationUrl?: string;
      category?: string;
      capacity?: number;
      sendReminders?: boolean;
      reminderDays?: number;
      attendeeType?: string;
    }
  ) {
    // Resolve slug to actual community ID
    const communityId = await this.communitiesService.resolveId(communityIdOrSlug);
    
    // Verify user is owner or manager
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        userId_communityId: { userId: createdById, communityId },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MANAGER')) {
      throw new ForbiddenException('Only community managers can create events');
    }

    // If recurring, create multiple event instances (unlimited until user edits).
    // Wrapped in a transaction so a failure mid-loop rolls everything back
    // instead of leaving N orphans for the user to clean up.
    if (data.isRecurring && data.recurringType) {
      const baseDate = new Date(data.date);
      // Practical occurrences: daily: 30 (1 month), weekly: 12 (3 months), monthly: 12 (1 year)
      const occurrences = data.recurringType === 'daily' ? 30 : data.recurringType === 'weekly' ? 12 : 12;

      const events = await this.prisma.$transaction(async (tx) => {
        const created: Array<{ id: string; title: string; [key: string]: unknown }> = [];
        for (let i = 0; i < occurrences; i++) {
          const eventDate = new Date(baseDate);

          if (data.recurringType === 'daily') {
            eventDate.setDate(eventDate.getDate() + i);
          } else if (data.recurringType === 'weekly') {
            eventDate.setDate(eventDate.getDate() + (i * 7));
          } else if (data.recurringType === 'monthly') {
            eventDate.setMonth(eventDate.getMonth() + i);
          }

          const event = await tx.event.create({
            data: {
              ...data,
              date: eventDate,
              communityId,
              createdById,
            },
            include: {
              _count: {
                select: { rsvps: true },
              },
            },
          });
          created.push(event);
        }
        return created;
      }, { timeout: 30_000 });

      return events[0]; // Return the first event
    }

    // Non-recurring event - create single instance
    return this.prisma.event.create({
      data: {
        ...data,
        communityId,
        createdById,
      },
      include: {
        _count: {
          select: { rsvps: true },
        },
        rsvps: {
          take: 5,
          include: {
            event: false,
          },
        },
      },
    });
  }

  async findByCommunity(communityIdOrSlug: string, userId?: string) {
    // Resolve slug to actual community ID
    const communityId = await this.communitiesService.resolveId(communityIdOrSlug);
    
    const events = await this.prisma.event.findMany({
      where: { communityId },
      orderBy: { date: 'asc' },
      include: {
        _count: {
          select: { rsvps: true },
        },
        rsvps: userId ? {
          where: { userId },
          select: { status: true, userId: true },
        } : false,
      },
    });

    return events.map(event => ({
      ...event,
      userRsvp: userId && event.rsvps && event.rsvps.length > 0 
        ? event.rsvps[0].status 
        : null,
      rsvpCounts: {
        going: 0,
        maybe: 0,
        notGoing: 0,
      },
    }));
  }

  async findUpcoming(communityIdOrSlug: string, limit: number = 5, userId?: string) {
    // Resolve slug to actual community ID
    const communityId = await this.communitiesService.resolveId(communityIdOrSlug);
    const now = new Date();
    
    const events = await this.prisma.event.findMany({
      where: { 
        communityId,
        date: { gte: now },
      },
      orderBy: { date: 'asc' },
      take: limit,
      include: {
        _count: {
          select: { rsvps: true },
        },
        rsvps: userId ? {
          where: { userId },
          select: { status: true },
        } : false,
      },
    });

    return events.map(event => ({
      ...event,
      userRsvp: userId && event.rsvps && event.rsvps.length > 0 
        ? event.rsvps[0].status 
        : null,
    }));
  }

  async findOne(eventId: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        rsvps: {
          select: {
            userId: true,
            status: true,
          },
        },
        _count: {
          select: { rsvps: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Count RSVPs by status
    const rsvpCounts = {
      going: event.rsvps.filter(r => r.status === 'GOING').length,
      maybe: event.rsvps.filter(r => r.status === 'MAYBE').length,
      notGoing: event.rsvps.filter(r => r.status === 'NOT_GOING').length,
    };

    const userRsvp = userId 
      ? event.rsvps.find(r => r.userId === userId)?.status || null
      : null;

    return {
      ...event,
      rsvpCounts,
      userRsvp,
    };
  }

  async update(
    eventId: string,
    userId: string,
    data: Partial<{
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
    }>
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { community: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify user is owner or manager
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        userId_communityId: { userId, communityId: event.communityId },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MANAGER')) {
      throw new ForbiddenException('Only community managers can update events');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data,
    });
  }

  async delete(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Verify user is owner or manager
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        userId_communityId: { userId, communityId: event.communityId },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MANAGER')) {
      throw new ForbiddenException('Only community managers can delete events');
    }

    return this.prisma.event.delete({
      where: { id: eventId },
    });
  }

  async rsvp(eventId: string, userId: string, status: RsvpStatus) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check capacity if going
    if (status === 'GOING' && event.capacity) {
      const goingCount = await this.prisma.eventRsvp.count({
        where: { eventId, status: 'GOING' },
      });

      // Check if user already has a GOING rsvp
      const existingRsvp = await this.prisma.eventRsvp.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (goingCount >= event.capacity && existingRsvp?.status !== 'GOING') {
        throw new ForbiddenException('Event is at full capacity');
      }
    }

    const rsvp = await this.prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status },
      create: { eventId, userId, status },
    });

    // Return updated counts
    const rsvpCounts = await this.getRsvpCounts(eventId);

    return { rsvp, rsvpCounts };
  }

  async removeRsvp(eventId: string, userId: string) {
    const rsvp = await this.prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!rsvp) {
      throw new NotFoundException('RSVP not found');
    }

    await this.prisma.eventRsvp.delete({
      where: { eventId_userId: { eventId, userId } },
    });

    const rsvpCounts = await this.getRsvpCounts(eventId);

    return { success: true, rsvpCounts };
  }

  async getAttendees(eventId: string, status?: RsvpStatus) {
    const where: Prisma.EventRsvpWhereInput = { eventId };
    if (status) {
      where.status = status;
    }

    const rsvps = await this.prisma.eventRsvp.findMany({
      where,
      include: {
        event: false,
      },
    });

    // Get user details for each RSVP
    const userIds = rsvps.map(r => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, profileImage: true },
    });

    return rsvps.map(rsvp => ({
      ...rsvp,
      user: users.find(u => u.id === rsvp.userId),
    }));
  }

  private async getRsvpCounts(eventId: string) {
    const [going, maybe, notGoing] = await Promise.all([
      this.prisma.eventRsvp.count({ where: { eventId, status: 'GOING' } }),
      this.prisma.eventRsvp.count({ where: { eventId, status: 'MAYBE' } }),
      this.prisma.eventRsvp.count({ where: { eventId, status: 'NOT_GOING' } }),
    ]);

    return { going, maybe, notGoing };
  }

  async getEventsForMonth(communityIdOrSlug: string, year: number, month: number, userId?: string, isManager?: boolean) {
    // Resolve slug to actual community ID
    const communityId = await this.communitiesService.resolveId(communityIdOrSlug);
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Build where clause
    const whereClause: Prisma.EventWhereInput = {
      communityId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Filter by attendeeType - managers see all, members see only 'all' events
    if (!isManager) {
      whereClause.attendeeType = 'all';
    }

    const events = await this.prisma.event.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
      include: {
        rsvps: {
          select: { status: true, userId: true },
        },
      },
    });

    return events.map(event => {
      // Calculate rsvpCounts for all events
      const rsvpCounts = {
        going: event.rsvps.filter(r => r.status === 'GOING').length,
        maybe: event.rsvps.filter(r => r.status === 'MAYBE').length,
        notGoing: event.rsvps.filter(r => r.status === 'NOT_GOING').length,
      };

      return {
        ...event,
        userRsvp: userId
          ? event.rsvps.find(r => r.userId === userId)?.status || null
          : null,
        rsvpCounts,
        rsvps: undefined, // Don't expose full rsvps array
      };
    });
  }
}
