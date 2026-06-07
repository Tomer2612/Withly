import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

// Ledger recording. PrismaService comes from the @Global PrismaModule, so
// this module only needs to provide + export the service. No controller yet
// — read endpoints (owner earnings, platform revenue) land in Mission 3.
@Module({
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
