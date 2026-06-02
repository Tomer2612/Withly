import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  // In ILS (whole number for HYP). 99 for owner Withly subscription;
  // community.price for paid-member subscriptions. 0 is allowed only for
  // J5=J2 card-on-file validations (Phase 3.1) where we'd like HYP to
  // suppress the amount display — caller passes 0; HYP either renders
  // ₪0.00 or rejects the SIGN (empirical test in progress).
  @IsNumber()
  @Min(0)
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
}
