import { Body, Controller, Get, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { HypService } from './hyp.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly hypService: HypService) {}

  // Returns a signed HYP payment URL the frontend redirects to. The user's
  // id from the JWT goes into the Info field so the verification redirect
  // can correlate the charge back to the right account.
  @UseGuards(AuthGuard('jwt'))
  @Post('create-payment')
  async createPayment(@Req() req, @Body() body: CreatePaymentDto) {
    const url = await this.hypService.signPayment({
      amount: body.amount,
      clientName: body.clientName,
      email: body.email,
      order: body.order,
      info: body.info ?? `userId:${req.user.userId}`,
    });
    return { url };
  }

  // HYP redirects the user's browser here after payment with the result in
  // the query string. We re-submit those params to HYP for verification,
  // then redirect the user to the frontend with a status flag. No JWT
  // guard — this is an external redirect, but verification with HYP
  // proves the transaction is real (the signature can't be forged).
  //
  // TODO when wiring real charge flows (HYP follow-up #16):
  //   - parse Order/Info to figure out what was paid for (owner sub vs
  //     member join vs renewal) and update the right DB rows.
  //   - record the transaction Id with a unique constraint to prevent
  //     replay/double-credit on duplicate redirects.
  @Get('payment-success')
  async paymentSuccess(@Query() query: Record<string, string>, @Res() res: Response) {
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      const result = await this.hypService.verifyTransaction(query);
      if (result.ok) {
        this.logger.log(
          `Payment verified: Id=${query.Id} Order=${query.Order} Amount=${query.Amount}`,
        );
        const order = encodeURIComponent(query.Order ?? '');
        return res.redirect(`${frontend}/?paid=ok&order=${order}`);
      }
      return res.redirect(`${frontend}/?paid=fail&ccode=${result.ccode ?? 'unknown'}`);
    } catch {
      return res.redirect(`${frontend}/?paid=error`);
    }
  }
}
