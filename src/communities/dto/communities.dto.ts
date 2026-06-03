import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ArrayMaxSize } from 'class-validator';

const URL_MAX = 500;

export class CreateCommunityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsOptional() @IsString() @MaxLength(50) topic?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) youtubeUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) whatsappUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) facebookUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) instagramUrl?: string;
}

// Existing-card flows (Phase 3.3+): the user picked a card from their
// wallet instead of tokenizing a new one through HYP. The id is the
// UserPaymentMethod row id (a cuid), not the HYP token.
export class BindExistingCardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  paymentMethodId!: string;
}

export class FinalizeWithExistingCardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  pendingId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  paymentMethodId!: string;
}

// Phase 4 Mission 3 — member joins a paid community using a card
// already on file. Iframe path uses tokenize-memberJoin dispatch and
// doesn't go through this DTO.
export class JoinPaidWithExistingCardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  paymentMethodId!: string;
}

// Pricing-checkout staging: same shape as CreateCommunityDto. Persisted as
// a PendingCommunityCreation row until the tokenize iframe completes, then
// promoted to a real Community in the same transaction that binds the card.
export class BeginCheckoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsOptional() @IsString() @MaxLength(50) topic?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) youtubeUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) whatsappUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) facebookUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) instagramUrl?: string;
}

// Multipart body for community update — every text field arrives as a string,
// even booleans and numbers. The service does the conversions.
export class UpdateCommunityDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(50) topic?: string | null;

  @IsOptional() @IsString() removeImage?: string;
  @IsOptional() @IsString() removeLogo?: string;

  @IsOptional() @IsString() @MaxLength(URL_MAX) youtubeUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) whatsappUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) facebookUrl?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) instagramUrl?: string;

  // JSON-encoded arrays — service does JSON.parse
  @IsOptional() @IsString() existingGalleryImages?: string;
  @IsOptional() @IsString() existingGalleryVideos?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) existingPrimaryImage?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) existingLogo?: string;

  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() @MaxLength(20) cardLastFour?: string;
  @IsOptional() @IsString() @MaxLength(50) cardBrand?: string;
  @IsOptional() @IsString() showOnlineMembers?: string;

  @IsOptional() @IsIn(['DRAFT', 'PRIVATE', 'PUBLIC']) status?: string;
}

// Owner-only payment fields. Lives on its own endpoint so the suspended
// community renewal flow can hit it without tripping assertActive.
export class UpdatePaymentInfoDto {
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() @MaxLength(20) cardLastFour?: string;
  @IsOptional() @IsString() @MaxLength(50) cardBrand?: string;
  // ISO date string when the owner-initiated subscription cancellation takes
  // effect. Pass null to clear (un-cancel). Actual deletion is handled later
  // by the HYP integration / cron job.
  @IsOptional() @IsString() subscriptionCancelledAt?: string | null;
}

export class UpdateMemberRoleDto {
  @IsIn(['MANAGER', 'USER'])
  role!: 'MANAGER' | 'USER';
}

export class UpdateRulesDto {
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  rules!: string[];
}

export class UpdateSlugDto {
  // Lowercase, alphanumeric, dashes/underscores, 3–40 chars.
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  slug!: string;
}
