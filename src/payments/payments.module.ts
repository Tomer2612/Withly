import { Module } from '@nestjs/common';
import { HypService } from './hyp.service';
import { PaymentsController } from './payments.controller';
import { UsersModule } from '../users/users.module';
import { CommunitiesModule } from '../communities/communities.module';

@Module({
  imports: [UsersModule, CommunitiesModule],
  controllers: [PaymentsController],
  providers: [HypService],
  exports: [HypService],
})
export class PaymentsModule {}
