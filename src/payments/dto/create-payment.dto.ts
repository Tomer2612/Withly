import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  // In ILS (whole number for HYP). 99 for owner Withly subscription;
  // community.price for paid-member subscriptions. Card-on-file flows
  // (Phase 3.1 J5=J2) send 1 — empirically Amount=0 triggers HYP's
  // donation mode (empty input field), worse UX than a small visible amount.
  @IsNumber()
  @Min(1)
  amount!: number;

  // Shows up on the HYP payment page + on the receipt.
  @IsString()
  @MaxLength(100)
  clientName!: string;

  @IsEmail()
  email!: string;

  // Internal order/transaction id — also returned by HYP on the redirect
  // so we can match the payment back to whatever it was paying for.
  @IsString()
  @MaxLength(100)
  order!: string;

  // Free-text description shown on the HYP page (optional).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  info?: string;

  // Phase 3 iframe support. When true, HYP redirects the PARENT window after
  // the iframe payment completes (instead of redirecting inside the iframe).
  // HYP-confirmed param name (2026-06). Sent as top-level SIGN param.
  @IsOptional()
  @IsBoolean()
  bof?: boolean;

  // Phase 3 card-validation mode. 'J2' = check card credibility only, no
  // charge, no credit-line preservation (the recommended pattern for
  // card-on-file in Settings Add-Card). 'True' = preserve credit line 3
  // days. Omit for normal charge flow.
  @IsOptional()
  @IsIn(['J2', 'True'])
  j5?: 'J2' | 'True';

  // Per-flow template choice for J5=J2 pages. true → tmp=5 (logo + visible
  // amount), used only where a real charge follows immediately (paid
  // member-join). Omitted/false → tmp=17 (hidden amount) for card-save /
  // deferred flows where showing an amount would mislead.
  @IsOptional()
  @IsBoolean()
  showAmount?: boolean;
}
