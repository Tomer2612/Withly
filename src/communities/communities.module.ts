import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { CommunityBillingCronService } from './community-billing-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { HypModule } from '../payments/hyp.module';
import { StorageModule } from '../common/storage.module';

@Module({
  providers: [CommunitiesService, CommunityBillingCronService],
  controllers: [CommunitiesController],
  imports: [NotificationsModule, EmailModule, HypModule, StorageModule],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}

