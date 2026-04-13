import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../users/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EventReminderService {
  private readonly logger = new Logger(EventReminderService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleEventReminders() {
    this.logger.log('Checking for upcoming event reminders...');

    try {
      const now = new Date();

      // Find events that need reminders:
      // - sendReminders is true
      // - reminderSentAt is null (not yet sent)
      // - event date is in the future
      // - event date is within reminderDays from now
      const events = await this.prisma.event.findMany({
        where: {
          sendReminders: true,
          reminderSentAt: null,
          date: {
            gt: now,
          },
        },
        include: {
          rsvps: {
            where: { status: 'GOING' },
            include: {
              event: false,
            },
          },
          community: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      for (const event of events) {
        // Check if we're within the reminder window
        const reminderDate = new Date(event.date);
        reminderDate.setDate(reminderDate.getDate() - event.reminderDays);

        if (now < reminderDate) {
          continue; // Too early to send reminder
        }

        // Get user details for all RSVPed users
        const userIds = event.rsvps.map((rsvp) => rsvp.userId);
        if (userIds.length === 0) {
          // Mark as sent even if no attendees, to avoid re-checking
          await this.prisma.event.update({
            where: { id: event.id },
            data: { reminderSentAt: now },
          });
          continue;
        }

        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        });

        const eventDate = event.date.toLocaleDateString('he-IL', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const eventTime = event.date.toLocaleTimeString('he-IL', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: event.timezone || 'Asia/Jerusalem',
        });

        const slug = event.community.slug || event.community.id;
        const eventLink = `${this.frontendUrl}/communities/${slug}/events`;

        // Send reminder to each attendee
        for (const user of users) {
          try {
            await this.emailService.sendEventReminder(
              user.email,
              user.name || 'משתמש',
              event.title,
              eventDate,
              eventTime,
              event.community.name,
              eventLink,
            );
            this.logger.log(`Sent reminder for "${event.title}" to ${user.email}`);
          } catch (error) {
            this.logger.error(`Failed to send reminder to ${user.email} for event ${event.id}`, error);
          }
        }

        // Mark reminder as sent
        await this.prisma.event.update({
          where: { id: event.id },
          data: { reminderSentAt: now },
        });

        this.logger.log(`Reminder sent for event "${event.title}" to ${users.length} attendees`);
      }
    } catch (error) {
      this.logger.error('Error processing event reminders', error);
    }
  }
}
