import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { UsersModule } from '../users/users.module';
import { CommunitiesModule } from '../communities/communities.module';
import { EmailModule } from '../email/email.module';
import { HypModule } from './hyp.module';

@Module({
  imports: [UsersModule, CommunitiesModule, EmailModule, HypModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
