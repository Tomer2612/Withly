import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { UsersModule } from '../users/users.module';
import { CommunitiesModule } from '../communities/communities.module';
import { EmailModule } from '../email/email.module';
import { HypModule } from './hyp.module';
import { DunningService } from './dunning.service';
import { PrismaService } from '../common/prisma.service';

// forwardRef on BOTH UsersModule and CommunitiesModule. There's a
// three-way cycle: AppModule -> UsersModule -> CommunitiesModule
// (forwardRef from Phase 5 wind-down) -> PaymentsModule (forwardRef
// from Phase 6.4 dunning) -> UsersModule. When the scan reaches us via
// CommunitiesModule, UsersModule is mid-load so the bare class
// reference resolves to undefined — wrap it in forwardRef so it's
// resolved lazily at DI time instead.
@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => CommunitiesModule),
    EmailModule,
    HypModule,
  ],
  controllers: [PaymentsController],
  providers: [DunningService, PrismaService],
  exports: [DunningService],
})
export class PaymentsModule {}
