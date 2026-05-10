import { IsEmail, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  // In ILS (whole number for HYP). 99 for owner Withly subscription;
  // community.price for paid-member subscriptions.
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

  // Frontend path to redirect the user to after the payment-success
  // verification. Encoded into HYP's Info field so it round-trips. Real
  // flows pass e.g. "/communities/{slug}/manage" to land the user back
  // where they started. Defaults to "/" if omitted.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  redirectPath?: string;
}
