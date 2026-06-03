import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { CommunityBillingCronService } from './community-billing-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  providers: [CommunitiesService, CommunityBillingCronService],
  controllers: [CommunitiesController],
  imports: [NotificationsModule, EmailModule],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}

