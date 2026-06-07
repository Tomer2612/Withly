import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { UsersModule } from '../users/users.module';
import { CommunitiesModule } from '../communities/communities.module';
import { EmailModule } from '../email/email.module';
import { HypModule } from './hyp.module';
import { DunningService } from './dunning.service';
import { PrismaService } from '../common/prisma.service';

// forwardRef on CommunitiesModule because CommunitiesModule's cron imports
// PaymentsModule for DunningService (failure handlers generate links).
@Module({
  imports: [UsersModule, forwardRef(() => CommunitiesModule), EmailModule, HypModule],
  controllers: [PaymentsController],
  providers: [DunningService, PrismaService],
  exports: [DunningService],
})
export class PaymentsModule {}
