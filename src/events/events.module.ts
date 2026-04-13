import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventReminderService } from './event-reminder.service';
import { PrismaService } from '../users/prisma.service';
import { CommunitiesModule } from '../communities/communities.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [CommunitiesModule, EmailModule, ConfigModule],
  controllers: [EventsController],
  providers: [EventsService, EventReminderService, PrismaService],
  exports: [EventsService],
})
export class EventsModule {}
