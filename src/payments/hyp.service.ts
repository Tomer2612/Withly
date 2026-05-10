import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

// Thin wrapper around the HYP Pay API. All server-to-server calls to
// https://pay.hyp.co.il/p/ go through here so the rest of the app can
// stay unaware of HYP's wire format. Two operations matter today:
//   - signPayment(): build a redirectable payment URL for the user
//   - verifyTransaction(): validate a redirect callback to confirm a charge
// (verifyTransaction is the next step — not implemented in this commit.)

const HYP_BASE = 'https://pay.hyp.co.il/p/';

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
}
