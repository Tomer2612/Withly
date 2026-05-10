import { Module } from '@nestjs/common';
import { HypService } from './hyp.service';
import { PaymentsController } from './payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [HypService],
  exports: [HypService],
})
export class PaymentsModule {}
