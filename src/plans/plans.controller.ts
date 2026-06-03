import { Controller, Get } from '@nestjs/common';
import { PlansService } from './plans.service';

// Public endpoints — plan info is marketing-page content. No JWT guard.
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // All active plans. The marketing /pricing page can render the list
  // when we go multi-plan; pre-launch this is just one row.
  @Get()
  getActive() {
    return this.plansService.getActive();
  }

  // The default plan only. Lighter payload for places that just need
  // "what's the headline plan right now" (pricing page header, card
  // confirm popups, etc.).
  @Get('default')
  getDefault() {
    return this.plansService.getDefault();
  }
}
