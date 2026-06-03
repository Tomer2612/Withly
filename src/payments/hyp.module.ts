import { Module } from '@nestjs/common';
import { HypService } from './hyp.service';

// Thin module wrapping HypService so consumers that need just the HYP
// API client (e.g., the community-billing cron for SOFT charges) can
// pull it without dragging the rest of PaymentsModule + the resulting
// circular import. PaymentsModule itself also imports this.
@Module({
  providers: [HypService],
  exports: [HypService],
})
export class HypModule {}
