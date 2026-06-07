import { Module, forwardRef } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { CommunityBillingCronService } from './community-billing-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { HypModule } from '../payments/hyp.module';
import { PaymentsModule } from '../payments/payments.module';
import { StorageModule } from '../common/storage.module';

// forwardRef on PaymentsModule — PaymentsModule already forwardRefs back
// to CommunitiesModule (DunningService needs CommunitiesService for member
// recovery in a later phase; for now the cron just needs DunningService
// for link generation).
@Module({
  providers: [CommunitiesService, CommunityBillingCronService],
  controllers: [CommunitiesController],
  imports: [
    NotificationsModule,
    EmailModule,
    HypModule,
    StorageModule,
    forwardRef(() => PaymentsModule),
  ],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}

