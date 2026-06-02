import { Module } from '@nestjs/common';
import { HypService } from './hyp.service';
import { PaymentsController } from './payments.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PaymentsController],
  providers: [HypService],
  exports: [HypService],
})
export class PaymentsModule {}
