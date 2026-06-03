import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventReminderService } from './event-reminder.service';
import { CommunitiesModule } from '../communities/communities.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CommunitiesModule, EmailModule, ConfigModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService, EventReminderService],
  exports: [EventsService],
})
export class EventsModule {}
