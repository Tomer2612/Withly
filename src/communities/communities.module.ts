import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { CommunityBillingCronService } from './community-billing-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  providers: [CommunitiesService, CommunityBillingCronService],
  controllers: [CommunitiesController],
  imports: [NotificationsModule],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}

