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
// Phase 3.3 — pricing checkout: new community creation. The community
// row does NOT exist yet; instead a PendingCommunityCreation row holds
// the staged form fields. On tokenize success we atomically create the
// Community + bind the card + delete the pending row.
// Order shape: tokenize-newCommunity-<pendingId>-<userId>-<ts>.
// Captures: 1 = pendingId, 2 = userId.
const TOKENIZE_NEW_COMMUNITY_ORDER_RE = /^tokenize-newCommunity-([a-z0-9]+)-([a-z0-9]+)-\d+$/;
// Phase 4 Mission 3 — paid member-join through the iframe (new card).
// After tokenize, the backend creates CommunityMember + MemberSubscription
// AND runs the first SOFT charge atomically. Failure: rollback, no join.
// Order shape: tokenize-memberJoin-<communityId>-<userId>-<ts>.
const TOKENIZE_MEMBER_JOIN_ORDER_RE = /^tokenize-memberJoin-([a-z0-9]+)-([a-z0-9]+)-\d+$/;

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
      showAmount: body.showAmount,
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
      const newCommunityMatch = order.match(TOKENIZE_NEW_COMMUNITY_ORDER_RE);
      if (newCommunityMatch) {
        const [, pendingId, userId] = newCommunityMatch;
        return this.handleTokenizeNewCommunity(query, result.body, userId, pendingId, res, frontend);
      }
      const memberJoinMatch = order.match(TOKENIZE_MEMBER_JOIN_ORDER_RE);
      if (memberJoinMatch) {
        const [, communityId, userId] = memberJoinMatch;
        return this.handleTokenizeMemberJoin(query, result.body, userId, communityId, res, frontend);
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

      const bindResult = await this.communitiesService.bindTokenizedPaymentMethod(
        communityId,
        userId,
        {
          id: paymentMethod.id,
          cardLastFour: paymentMethod.cardLastFour,
          cardBrand: paymentMethod.cardBrand,
        },
      );
      const { community, wasAlreadyBound, wasReactivated, chargeAttempted, chargeFailed, chargeCCode } = bindResult;

      this.logger.log(
        `Community card bound: userId=${userId} communityId=${communityId} ` +
        `last4=${cardLastFour} brand=${cardBrand} ` +
        `tokenSuffix=${tokenResult.token.slice(-4)} ` +
        `wasAlreadyBound=${wasAlreadyBound} chargeAttempted=${chargeAttempted} ` +
        `wasReactivated=${wasReactivated} chargeCCode=${chargeCCode ?? '-'}`,
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

      // Mission 5 redirect taxonomy:
      //   reactivated   = was SUSPENDED, recovery SOFT succeeded
      //   charge-failed = was SUSPENDED, recovery SOFT rejected (card
      //                   still bound; owner can retry)
      //   existing      = same card re-bound, no charge attempted
      //   updated       = fresh card on ACTIVE community, no charge
      const cardParam =
        wasReactivated ? 'reactivated'
        : chargeFailed ? 'charge-failed'
        : wasAlreadyBound ? 'existing'
        : 'updated';
      return res.redirect(`${frontend}/communities/${communityId}/manage?card=${cardParam}`);
    } catch (err) {
      this.logger.error(`Community tokenize flow error: ${(err as Error).message}`);
      return res.redirect(failureRedirect);
    }
  }

  // Phase 3.3 — pricing checkout: atomic new-community creation. The
  // Community row does not yet exist; the staged fields live in a
  // PendingCommunityCreation row keyed by pendingId. Flow: mint token →
  // upsert UserPaymentMethod → finalizeCommunityFromPending (one
  // transaction: create Community + bind card + delete pending). Failure
  // at any step leaves no half-state — community is created only on full
  // success.
  private async handleTokenizeNewCommunity(
    query: Record<string, string>,
    verifiedBody: Record<string, string>,
    userId: string,
    pendingId: string,
    res: Response,
    frontend: string,
  ) {
    const failureRedirect = `${frontend}/pricing?card=error`;
    try {
      const tokenResult = await this.hypService.getToken(query.Id);
      if (
        !tokenResult.ok
        || !tokenResult.token
        || tokenResult.expMonth === null
        || tokenResult.expYear === null
      ) {
        this.logger.error(
          `getToken failed (newCommunity): Id=${query.Id} userId=${userId} ` +
          `pendingId=${pendingId} CCode=${tokenResult.ccode}`,
        );
        return res.redirect(failureRedirect);
      }

      const cardLastFour = verifiedBody.L4digit || tokenResult.token.slice(-4);
      const cardBrand = bankIdToBrand(verifiedBody.Bank);

      const { paymentMethod, isNew } = await this.usersService.addTokenizedPaymentMethod(userId, {
        token: tokenResult.token,
        expMonth: tokenResult.expMonth,
        expYear: tokenResult.expYear,
        cardLastFour,
        cardBrand,
      });

      const community = await this.communitiesService.finalizeCommunityFromPending(
        pendingId,
        userId,
        {
          id: paymentMethod.id,
          cardLastFour: paymentMethod.cardLastFour,
          cardBrand: paymentMethod.cardBrand,
        },
      );

      this.logger.log(
        `New community created via pricing checkout: userId=${userId} ` +
        `communityId=${community.id} pendingId=${pendingId} ` +
        `last4=${cardLastFour} brand=${cardBrand} isNewCard=${isNew} ` +
        `tokenSuffix=${tokenResult.token.slice(-4)}`,
      );

      // Phase 3.6 — security email on truly new cards only (suppress if
      // the user already had this card on file). The community itself
      // doesn't get a "card updated" email since it's brand new — the
      // redirect to /manage IS the confirmation.
      if (isNew) {
        void this.sendCardAddedEmailSafely(userId, cardBrand, cardLastFour);
      }

      // Land the new owner on the community feed — the welcome popup there
      // (localStorage-gated, fires on first owner visit) is the creation
      // confirmation. The manage page has no `created` case, so redirecting
      // there showed nothing.
      return res.redirect(`${frontend}/communities/${community.id}/feed`);
    } catch (err) {
      this.logger.error(`New-community tokenize flow error: ${(err as Error).message}`);
      return res.redirect(failureRedirect);
    }
  }

  // Phase 4 Mission 3 — paid member-join via iframe (new card path).
  // After tokenize: mint token + persist UserPaymentMethod (dedup-aware),
  // then call CommunitiesService.finalizePaidJoinFromTokenize which
  // atomically creates membership + runs first SOFT charge.
  //
  // Failure modes:
  //   - getToken rejection → redirect to preview?card=error (no membership)
  //   - finalize throws (HYP CCode != 0, already a member, etc.) →
  //     redirect to preview?card=error (no membership — atomic rollback)
  //   - success → /communities/<id>/feed?card=joined
  private async handleTokenizeMemberJoin(
    query: Record<string, string>,
    verifiedBody: Record<string, string>,
    userId: string,
    communityId: string,
    res: Response,
    frontend: string,
  ) {
    const failureRedirect = `${frontend}/communities/${communityId}/preview?card=error`;
    try {
      const tokenResult = await this.hypService.getToken(query.Id);
      if (
        !tokenResult.ok
        || !tokenResult.token
        || tokenResult.expMonth === null
        || tokenResult.expYear === null
      ) {
        this.logger.error(
          `getToken failed (memberJoin): Id=${query.Id} userId=${userId} ` +
          `communityId=${communityId} CCode=${tokenResult.ccode}`,
        );
        return res.redirect(failureRedirect);
      }

      // Same J5=J2 fallback as the other Phase 3.x flows — last4/Bank
      // aren't populated on validation-only flows.
      const cardLastFour = verifiedBody.L4digit || tokenResult.token.slice(-4);
      const cardBrand = bankIdToBrand(verifiedBody.Bank);

      const { paymentMethod } = await this.usersService.addTokenizedPaymentMethod(userId, {
        token: tokenResult.token,
        expMonth: tokenResult.expMonth,
        expYear: tokenResult.expYear,
        cardLastFour,
        cardBrand,
      });

      try {
        await this.communitiesService.finalizePaidJoinFromTokenize(communityId, userId, {
          id: paymentMethod.id,
          hypPaymentMethodId: tokenResult.token,
          cardExpMonth: tokenResult.expMonth,
          cardExpYear: tokenResult.expYear,
          cardLastFour,
          cardBrand,
        });
      } catch (err) {
        // Atomic rollback already happened inside the service; just log
        // and redirect with an error param so the frontend shows a toast.
        this.logger.warn(
          `Paid join finalize failed: user=${userId} community=${communityId}: ${(err as Error).message}`,
        );
        return res.redirect(failureRedirect);
      }

      this.logger.log(
        `Paid join (iframe): userId=${userId} communityId=${communityId} ` +
        `last4=${cardLastFour} brand=${cardBrand} tokenSuffix=${tokenResult.token.slice(-4)}`,
      );
      return res.redirect(`${frontend}/communities/${communityId}/feed?card=joined`);
    } catch (err) {
      this.logger.error(`Paid join tokenize flow error: ${(err as Error).message}`);
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
