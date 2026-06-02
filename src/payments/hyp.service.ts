import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

// Thin wrapper around the HYP Pay API. All server-to-server calls to
// https://pay.hyp.co.il/p/ go through here so the rest of the app can
// stay unaware of HYP's wire format. Two operations matter today:
//   - signPayment(): build a redirectable payment URL for the user
//   - verifyTransaction(): validate a redirect callback to confirm a charge
// (verifyTransaction is the next step — not implemented in this commit.)

// /p3 = HYP's 3DS-enabled processor (yaadpay3ds.pl). HYP-confirmed
// 2026-06-02: switching from /p to /p3 makes the new-template console
// settings (button color/text, hidden ID field, terms link) actually
// apply on the live page. The old /p still routes through the legacy
// processor where the design panel is inert.
const HYP_BASE = 'https://pay.hyp.co.il/p3';

interface SignPaymentInput {
  /** Amount in ILS (whole number). */
  amount: number;
  /** Customer-facing name on the HYP page + receipt. */
  clientName: string;
  email: string;
  /** Internal order id; HYP echoes this back on the redirect. */
  order: string;
  /** Free-text description shown on the HYP page (optional). */
  info?: string;
  /**
   * Phase 3 iframe support. When true, sends BOF=True so HYP redirects the
   * parent window (instead of inside the iframe) after payment completes.
   * HYP-confirmed top-level SIGN param (2026-06).
   */
  bof?: boolean;
  /**
   * Card-validation mode. 'J2' = card credibility check only, no charge,
   * no credit-line preservation (Settings Add-Card pattern). 'True' = 3-day
   * credit-line preservation. Omit for normal charge.
   */
  j5?: 'J2' | 'True';
}

export interface GetTokenResult {
  /** True when CCode === '0' and a token was minted. */
  ok: boolean;
  /** Raw HYP CCode from the response (null only on unparseable response). */
  ccode: string | null;
  /** 19-digit HYP token (null on failure). */
  token: string | null;
  /** Card expiry month, 1-12, parsed from HYP's Tokef (YYMM). Null on failure. */
  expMonth: number | null;
  /** Card expiry year, 4-digit (e.g., 2026). Null on failure. */
  expYear: number | null;
}

@Injectable()
export class HypService {
  private readonly logger = new Logger(HypService.name);
  private readonly masof: string;
  private readonly key: string;
  private readonly passp: string;

  constructor() {
    const masof = process.env.HYP_MASOF;
    const key = process.env.HYP_KEY;
    const passp = process.env.HYP_PASSP;
    if (!masof || !key || !passp) {
      throw new Error(
        'HYP env vars missing. Need HYP_MASOF, HYP_KEY, HYP_PASSP.',
      );
    }
    this.masof = masof;
    this.key = key;
    this.passp = passp;
  }

  /**
   * Get a signed payment URL the user can be redirected to.
   *
   * Sends a SIGN request to HYP with the given params + credentials. HYP
   * returns the same params with `signature` appended and `action` flipped
   * to `pay`. We URL-prefix that and hand the link back.
   */
  async signPayment(input: SignPaymentInput): Promise<string> {
    const params = new URLSearchParams({
      action: 'APISign',
      What: 'SIGN',
      Masof: this.masof,
      KEY: this.key,
      PassP: this.passp,
      Amount: input.amount.toString(),
      Coin: '1', // 1 = ILS
      PageLang: 'HEB', // HYP expects HEB / ENG (not ISO he/en)
      SendHesh: 'True', // Trigger automatic receipt + customer email after charge
      ClientName: input.clientName,
      email: input.email,
      Order: input.order,
      ...(input.info ? { Info: input.info } : {}),
      ...(input.bof ? { BOF: 'True' } : {}),
      ...(input.j5 ? { J5: input.j5 } : {}),
      // tmp=17 is HYP's hidden-amount template designed specifically for
      // J5=J2 card-validation flows (HYP-confirmed 2026-06-02). Pairing
      // them suppresses the amount line on the page entirely — which is
      // what we want for "save card, no charge" UX. Don't apply outside
      // J5=J2 since this template is purpose-built and may not render
      // correctly for actual charge flows.
      ...(input.j5 === 'J2' ? { tmp: '17' } : {}),
      // MoreData=True unlocks the extra redirect fields (L4digit, Bank,
      // Brand, etc.) we need to store human-readable card info alongside
      // the token. Baseline-on — useful for logging on every flow.
      MoreData: 'True',
      UTF8: 'True',
      UTF8out: 'True',
      Sign: 'True',
    });

    let res: Response;
    try {
      res = await fetch(HYP_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (err) {
      this.logger.error(`HYP network error: ${(err as Error).message}`);
      throw new InternalServerErrorException('Payment provider unreachable');
    }

    if (!res.ok) {
      this.logger.error(`HYP returned HTTP ${res.status}`);
      throw new InternalServerErrorException('Payment provider error');
    }

    const text = await res.text();
    const parsed = new URLSearchParams(text);

    if (!parsed.get('signature')) {
      // HYP returns CCode on errors (not on SIGN success), so log it for diagnosis.
      const ccode = parsed.get('CCode');
      this.logger.error(
        `HYP did not return a signature. CCode=${ccode ?? '?'} body=${text}`,
      );
      throw new InternalServerErrorException('Payment provider rejected request');
    }

    return `${HYP_BASE}?${text}`;
  }

  /**
   * Verify a transaction after HYP redirects the user back to our site.
   *
   * HYP redirects with a query string like `?Id=...&CCode=0&Amount=99&Sign=...`.
   * We send all those params back to HYP with `What=VERIFY` + our credentials;
   * HYP confirms the signature and replies with CCode=0 if legitimate.
   *
   * Returns the parsed verification response so the caller can decide what to
   * do (update DB, redirect, etc). `ok` is true only when CCode === '0'.
   */
  async verifyTransaction(
    params: Record<string, string>,
  ): Promise<{ ok: boolean; ccode: string | null; body: Record<string, string> }> {
    const verifyParams = new URLSearchParams({
      ...params,
      action: 'APISign',
      What: 'VERIFY',
      KEY: this.key,
      PassP: this.passp,
      Masof: this.masof,
    });

    let res: Response;
    try {
      res = await fetch(HYP_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verifyParams.toString(),
      });
    } catch (err) {
      this.logger.error(`HYP verify network error: ${(err as Error).message}`);
      throw new InternalServerErrorException('Payment provider unreachable');
    }

    if (!res.ok) {
      this.logger.error(`HYP verify HTTP ${res.status}`);
      throw new InternalServerErrorException('Payment provider error');
    }

    const text = await res.text();
    // HYP's response body sometimes ends with a trailing newline, which
    // attaches to the last URL-parsed value (typically CCode). Trim every
    // value so equality checks aren't confused by stray whitespace.
    const body: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(text).entries()) {
      body[k] = v.trim();
    }
    const ccode = body.CCode ?? null;
    const ok = ccode === '0';

    if (!ok) {
      this.logger.warn(`HYP verify rejected: CCode=${ccode} body=${text}`);
    }

    return { ok, ccode, body };
  }

  /**
   * Mint a 19-digit HYP token from a completed transaction.
   *
   * Called after a successful hosted-page / iframe payment (typically a
   * J5=J2 card-validation in Phase 3.1, but works for any successful pay).
   * Returns the token + card expiry split out from HYP's Tokef (YYMM).
   *
   * Runs on the ORIGINAL payment terminal (the same Masof the transaction
   * was made on) — NOT the new token-charging terminal. The token-terminal
   * is for SOFT charges only; getToken always runs on the pay-terminal.
   *
   * HYP doesn't store card expiry alongside the token, so we extract it
   * from Tokef here and the caller stores it in UserPaymentMethod.
   */
  async getToken(transactionId: string): Promise<GetTokenResult> {
    const params = new URLSearchParams({
      action: 'getToken',
      Masof: this.masof,
      PassP: this.passp,
      TransId: transactionId,
    });

    let res: Response;
    try {
      res = await fetch(HYP_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (err) {
      this.logger.error(`HYP getToken network error: ${(err as Error).message}`);
      throw new InternalServerErrorException('Payment provider unreachable');
    }

    if (!res.ok) {
      this.logger.error(`HYP getToken HTTP ${res.status}`);
      throw new InternalServerErrorException('Payment provider error');
    }

    const text = await res.text();
    // Same trailing-newline trim as verifyTransaction — HYP responses end
    // in \n which would otherwise attach to the last value.
    const body: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(text).entries()) {
      body[k] = v.trim();
    }

    const ccode = body.CCode ?? null;
    const ok = ccode === '0';

    if (!ok) {
      this.logger.warn(`HYP getToken rejected: CCode=${ccode} body=${text}`);
      return { ok: false, ccode, token: null, expMonth: null, expYear: null };
    }

    const token = body.Token ?? null;
    const tokef = body.Tokef ?? null;

    let expMonth: number | null = null;
    let expYear: number | null = null;
    // HYP returns Tokef as 4-digit YYMM (e.g., "2604" = April 2026). Store
    // as full year + month for typed querying; convert back to Tmonth/Tyear
    // on each SOFT charge.
    if (tokef && /^\d{4}$/.test(tokef)) {
      expYear = 2000 + parseInt(tokef.slice(0, 2), 10);
      expMonth = parseInt(tokef.slice(2, 4), 10);
    }

    return { ok, ccode, token, expMonth, expYear };
  }
}
