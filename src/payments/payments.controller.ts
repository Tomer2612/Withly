import { All, Body, Controller, Get, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { HypService } from './hyp.service';
import { UsersService } from '../users/users.service';
import { CommunitiesService } from '../communities/communities.service';
import { EmailService } from '../email/email.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

// HYP returns `Bank` as a small integer indicating the card brand. Map to
// human-readable strings for the stored cardBrand column. Defaults to
// 'Visa' on unknown/missing to stay compatible with the legacy default.
const BANK_TO_BRAND: Record<string, string> = {
  '1': 'Isracard',
  '2': 'Visa Cal',
  '3': 'Diners',
  '4': 'Amex',
  '6': 'MAX',
  '99': 'BIT',
};

function bankIdToBrand(bank: string | undefined): string {
  if (!bank) return 'Visa';
  return BANK_TO_BRAND[bank] ?? 'Visa';
}

// Order conventions for paymentSuccess dispatch (Phase 3+). The Order field
// round-trips reliably from SIGN to redirect (verified on prod) and HYP's
// signature covers it, so we can trust the values here.
const TOKENIZE_CARD_ON_FILE_ORDER_RE = /^tokenize-cardOnFile-([a-zA-Z0-9_-]+)-\d+$/;
// Phase 3.2 — community card update / suspended-community renewal.
// Order shape: tokenize-community-<communityId>-<userId>-<ts>. The frontend
// modal puts communityId in its prefix and the shared HypPaymentIframeModal
// appends userId+timestamp. Captures: 1 = communityId, 2 = userId. Cuids
// are lowercase alphanumeric so the regex parses unambiguously across
// the two id boundaries.
const TOKENIZE_COMMUNITY_ORDER_RE = /^tokenize-community-([a-z0-9]+)-([a-z0-9]+)-\d+$/;

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly hypService: HypService,
    private readonly usersService: UsersService,
    private readonly communitiesService: CommunitiesService,
    private readonly emailService: EmailService,
  ) {}

  // Returns a signed HYP payment URL the frontend redirects to. The user's
  // id from the JWT goes into the Info field so the verification redirect
  // can correlate the charge back to the right account.
  @UseGuards(AuthGuard('jwt'))
  @Post('create-payment')
  async createPayment(@Req() req, @Body() body: CreatePaymentDto) {
    // Info is free-text only — HYP echoes it back as a tag for support /
    // debugging but it doesn't reliably round-trip on the success redirect.
    // Payment context (which flow paid for what) belongs in `Order`, which
    // does round-trip — see paymentSuccess() below.
    const url = await this.hypService.signPayment({
      amount: body.amount,
      clientName: body.clientName,
      email: body.email,
      order: body.order,
      info: body.info ?? `userId:${req.user.userId}`,
      bof: body.bof,
      j5: body.j5,
    });
    return { url };
  }

  // HYP redirects the user's browser here after payment with the result in
  // the query string. We re-submit those params to HYP for verification,
  // then dispatch on the Order prefix:
  //   - tokenize-cardOnFile-{userId}-{ts} → mint token via getToken, store
  //     UserPaymentMethod, send user back to /settings.
  //   - other (legacy charge) → default redirect to / with the status flag.
  //
  // No JWT guard — this is an external redirect from HYP, but the signature
  // verification + HYP's coverage of the Order field is the auth chain.
  //
  // TODO when wiring more charge flows (Phase 3.3, 3.4, Phase 4):
  //   add Order prefixes (ownersub-, memberJoin-, renew-) and matching
  //   dispatch arms here.
  @Get('payment-success')
  async paymentSuccess(@Query() query: Record<string, string>, @Res() res: Response) {
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      const result = await this.hypService.verifyTransaction(query);
      if (!result.ok) {
        this.logger.warn(
          `Payment failed verify: Id=${query.Id} CCode=${result.ccode} Order=${query.Order}`,
        );
        return res.redirect(`${frontend}/?paid=fail&ccode=${result.ccode ?? 'unknown'}`);
      }

      const order = query.Order ?? '';
      const tokenizeMatch = order.match(TOKENIZE_CARD_ON_FILE_ORDER_RE);
      if (tokenizeMatch) {
        return this.handleTokenizeCardOnFile(query, result.body, tokenizeMatch[1], res, frontend);
      }
      const communityMatch = order.match(TOKENIZE_COMMUNITY_ORDER_RE);
      if (communityMatch) {
        const [, communityId, userId] = communityMatch;
        return this.handleTokenizeCommunity(query, result.body, userId, communityId, res, frontend);
      }

      // Default successful-payment redirect (legacy charge flow).
      this.logger.log(
        `Payment verified: Id=${query.Id} Order=${query.Order} Amount=${query.Amount}`,
      );
      return res.redirect(
        `${frontend}/?paid=ok&order=${encodeURIComponent(order)}`,
      );
    } catch (err) {
      this.logger.error(`paymentSuccess error: ${(err as Error).message}`);
      return res.redirect(`${frontend}/?paid=error`);
    }
  }

  // Phase 3.1 — Settings Add-Card tokenize flow.
  // After a successful J5=J2 validation, mint a token via getToken and
  // persist a new UserPaymentMethod for the user. The userId is recovered
  // from the Order field (server-constructed at SIGN time, signed by HYP
  // on return — trustable).
  private async handleTokenizeCardOnFile(
    query: Record<string, string>,
    verifiedBody: Record<string, string>,
    userId: string,
    res: Response,
    frontend: string,
  ) {
    try {
      const tokenResult = await this.hypService.getToken(query.Id);
      if (
        !tokenResult.ok
        || !tokenResult.token
        || tokenResult.expMonth === null
        || tokenResult.expYear === null
      ) {
        this.logger.error(
          `getToken failed: Id=${query.Id} userId=${userId} CCode=${tokenResult.ccode}`,
        );
        return res.redirect(`${frontend}/settings?card=error#payment`);
      }

      // J5=J2 redirects don't include L4digit / Bank in the verified body
      // (MoreData=True only populates them on full charge flows). Fall back
      // to the last 4 of the 19-digit token, which by HYP convention matches
      // the underlying card's last 4 (confirmed empirically 2026-06).
      const cardLastFour = verifiedBody.L4digit || tokenResult.token.slice(-4);
      const cardBrand = bankIdToBrand(verifiedBody.Bank);

      const { isNew } = await this.usersService.addTokenizedPaymentMethod(userId, {
        token: tokenResult.token,
        expMonth: tokenResult.expMonth,
        expYear: tokenResult.expYear,
        cardLastFour,
        cardBrand,
      });

      this.logger.log(
        `Card tokenized: userId=${userId} last4=${cardLastFour} brand=${cardBrand} ` +
        `exp=${tokenResult.expMonth}/${tokenResult.expYear} tokenSuffix=${tokenResult.token.slice(-4)} ` +
        `isNew=${isNew}`,
      );

      // Phase 3.6 — fire-and-forget security email on truly new cards only.
      // Suppress on token-refresh (isNew=false) so re-adding the same card
      // doesn't spam the user.
      if (isNew) {
        void this.sendCardAddedEmailSafely(userId, cardBrand, cardLastFour);
      }

      // Hash routes the user to the תשלומים tab. The card query param tells
      // the page which toast to show (added = new card, existing = had it).
      const cardParam = isNew ? 'added' : 'existing';
      return res.redirect(`${frontend}/settings?card=${cardParam}#payment`);
    } catch (err) {
      this.logger.error(`Tokenize flow error: ${(err as Error).message}`);
      return res.redirect(`${frontend}/settings?card=error#payment`);
    }
  }

  // Phase 3.2 — community card update / suspended-community renewal.
  // Same shape as handleTokenizeCardOnFile but also binds the resulting
  // UserPaymentMethod to the community via CommunitiesService. The bind
  // step replicates the legacy SUSPENDED→ACTIVE placeholder (real SOFT
  // retry comes in Phase 4.4).
  private async handleTokenizeCommunity(
    query: Record<string, string>,
    verifiedBody: Record<string, string>,
    userId: string,
    communityId: string,
    res: Response,
    frontend: string,
  ) {
    const failureRedirect = `${frontend}/communities/${communityId}/manage?card=error`;
    try {
      const tokenResult = await this.hypService.getToken(query.Id);
      if (
        !tokenResult.ok
        || !tokenResult.token
        || tokenResult.expMonth === null
        || tokenResult.expYear === null
      ) {
        this.logger.error(
          `getToken failed (community): Id=${query.Id} userId=${userId} ` +
          `communityId=${communityId} CCode=${tokenResult.ccode}`,
        );
        return res.redirect(failureRedirect);
      }

      // J5=J2 redirects omit L4digit/Bank — same fallback as cardOnFile.
      const cardLastFour = verifiedBody.L4digit || tokenResult.token.slice(-4);
      const cardBrand = bankIdToBrand(verifiedBody.Bank);

      const { paymentMethod } = await this.usersService.addTokenizedPaymentMethod(userId, {
        token: tokenResult.token,
        expMonth: tokenResult.expMonth,
        expYear: tokenResult.expYear,
        cardLastFour,
        cardBrand,
      });

      const { community, wasAlreadyBound } = await this.communitiesService.bindTokenizedPaymentMethod(
        communityId,
        userId,
        {
          id: paymentMethod.id,
          cardLastFour: paymentMethod.cardLastFour,
          cardBrand: paymentMethod.cardBrand,
        },
      );

      this.logger.log(
        `Community card bound: userId=${userId} communityId=${communityId} ` +
        `last4=${cardLastFour} brand=${cardBrand} ` +
        `tokenSuffix=${tokenResult.token.slice(-4)} wasAlreadyBound=${wasAlreadyBound}`,
      );

      // Phase 3.6 — fire-and-forget security email when the community's
      // billing card actually changed. Skip on wasAlreadyBound to avoid
      // noise when an owner re-enters the same card (e.g., on the
      // suspended-renewal flow where the card is intentionally unchanged).
      if (!wasAlreadyBound) {
        void this.sendCommunityCardUpdatedEmailSafely(
          userId,
          community.name,
          cardBrand,
          cardLastFour,
        );
      }

      // existing = community already had this card. updated = new card (or
      // first time binding). Either way the manage page picks up the
      // ACTIVE flip (if the community was SUSPENDED) on refresh.
      const cardParam = wasAlreadyBound ? 'existing' : 'updated';
      return res.redirect(`${frontend}/communities/${communityId}/manage?card=${cardParam}`);
    } catch (err) {
      this.logger.error(`Community tokenize flow error: ${(err as Error).message}`);
      return res.redirect(failureRedirect);
    }
  }

  // Phase 3.6 — fire-and-forget email helpers. Look up user once, swallow
  // any send error (Resend hiccup, user without email, etc.) — these emails
  // are confirmation/security notifications, not transactional gates, so a
  // failed send must never block the tokenize redirect.
  private async sendCardAddedEmailSafely(
    userId: string,
    cardBrand: string,
    cardLastFour: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user?.email) return;
      await this.emailService.sendPaymentMethodAddedEmail(
        user.email,
        user.name ?? user.email,
        cardBrand,
        cardLastFour,
      );
    } catch (err) {
      this.logger.warn(`Card-added email failed (userId=${userId}): ${(err as Error).message}`);
    }
  }

  private async sendCommunityCardUpdatedEmailSafely(
    userId: string,
    communityName: string,
    cardBrand: string,
    cardLastFour: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user?.email) return;
      await this.emailService.sendCommunityCardUpdatedEmail(
        user.email,
        user.name ?? user.email,
        communityName,
        cardBrand,
        cardLastFour,
      );
    } catch (err) {
      this.logger.warn(
        `Community-card-updated email failed (userId=${userId}): ${(err as Error).message}`,
      );
    }
  }

  // HYP webhook: async server-to-server delivery of transaction results for
  // hosted-page (action=pay) charges. Does NOT fire for action=SOFT token
  // charges — those are reconciled synchronously inside the SOFT response.
  // Real job: reliability for the redirect-orphan case where the browser
  // fails to deliver the success redirect (closed tab, network blip, server
  // restart). HYP retries non-200 with linear 10-min backoff up to ~4h40m,
  // so we ALWAYS return 200 — even when processing fails, retrying won't help.
  //
  // No JWT guard — auth is the signature inside the payload, validated via
  // verifyTransaction() (same scheme as the redirect callback).
  //
  // @All because HYP confirmed payload format matches the redirect query
  // string but didn't specify the HTTP method; defensive against either.
  // Params come from query (GET) or body (POST urlencoded/JSON); merge both.
  //
  // State reconciliation (upserting charges, advancing subscriptions) is
  // deferred to Phase 3 — until first-payment entry points exist there are
  // no charges to reconcile, and the charge-record schema falls out of
  // Phase 3's design.
  @All('hyp-webhook')
  async hypWebhook(@Req() req: Request, @Res() res: Response) {
    const params = { ...req.query, ...(req.body ?? {}) } as Record<string, string>;
    try {
      const result = await this.hypService.verifyTransaction(params);
      this.logger.log(
        `HYP webhook: Id=${params.Id} CCode=${params.CCode} Amount=${params.Amount} ` +
        `Order=${params.Order} verified=${result.ok}`,
      );
    } catch (err) {
      this.logger.error(
        `HYP webhook processing failed: ${(err as Error).message} ` +
        `Id=${params.Id} CCode=${params.CCode}`,
      );
    }
    res.status(200).send('OK');
  }
}
