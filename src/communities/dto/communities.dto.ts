import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';

const URL_MAX = 500;
// Empty string clears the field; anything else must be an http(s) URL so a
// `javascript:` value can never land in an href on About/Preview.
const HTTP_URL_OR_EMPTY = /^(|https?:\/\/\S+)$/i;
// Social links: empty, or an http(s) URL whose host is one of the platform's
// domains (or a subdomain, e.g. m.facebook.com / chat.whatsapp.com).
// Keep the domain lists in sync with SOCIAL_DOMAINS in frontend/app/lib/linkUtils.ts.
const socialUrlOrEmpty = (domains: string[]) =>
  new RegExp(
    `^(|https?:\\/\\/([a-z0-9-]+\\.)*(${domains.map((d) => d.replace(/\./g, '\\.')).join('|')})([/?#]\\S*)?)$`,
    'i',
  );
const YOUTUBE_URL_OR_EMPTY = socialUrlOrEmpty(['youtube.com', 'youtu.be']);
const WHATSAPP_URL_OR_EMPTY = socialUrlOrEmpty(['whatsapp.com', 'wa.me']);
const FACEBOOK_URL_OR_EMPTY = socialUrlOrEmpty([
  'facebook.com',
  'fb.com',
  'fb.me',
]);
const INSTAGRAM_URL_OR_EMPTY = socialUrlOrEmpty([
  'instagram.com',
  'instagr.am',
]);
const LINKEDIN_URL_OR_EMPTY = socialUrlOrEmpty(['linkedin.com']);

// Applies the max length + platform check to one social-link field.
const SocialUrl =
  (pattern: RegExp, platform: string): PropertyDecorator =>
  (target, key) => {
    IsOptional()(target, key);
    IsString()(target, key);
    MaxLength(URL_MAX)(target, key);
    Matches(pattern, { message: `${String(key)} must be a ${platform} link` })(
      target,
      key,
    );
  };

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

// Pricing-checkout staging (the only way to create a community). Persisted as
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
  @SocialUrl(YOUTUBE_URL_OR_EMPTY, 'YouTube') youtubeUrl?: string;
  @SocialUrl(WHATSAPP_URL_OR_EMPTY, 'WhatsApp') whatsappUrl?: string;
  @SocialUrl(FACEBOOK_URL_OR_EMPTY, 'Facebook') facebookUrl?: string;
  @SocialUrl(INSTAGRAM_URL_OR_EMPTY, 'Instagram') instagramUrl?: string;
  // Plan the owner picked on the pricing page (e.g. "starter" | "pro").
  // Resolved server-side to a plan id and stored on the pending row.
  @IsOptional() @IsString() @MaxLength(50) planSlug?: string;
}

// Multipart body for community update — every text field arrives as a string,
// even booleans and numbers. The service does the conversions.
export class UpdateCommunityDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(50) topic?: string | null;

  @IsOptional() @IsString() removeImage?: string;
  @IsOptional() @IsString() removeLogo?: string;

  @SocialUrl(YOUTUBE_URL_OR_EMPTY, 'YouTube') youtubeUrl?: string;
  @SocialUrl(WHATSAPP_URL_OR_EMPTY, 'WhatsApp') whatsappUrl?: string;
  @SocialUrl(FACEBOOK_URL_OR_EMPTY, 'Facebook') facebookUrl?: string;
  @SocialUrl(INSTAGRAM_URL_OR_EMPTY, 'Instagram') instagramUrl?: string;
  @SocialUrl(LINKEDIN_URL_OR_EMPTY, 'LinkedIn') linkedinUrl?: string;
  @IsOptional()
  @IsString()
  @MaxLength(URL_MAX)
  @Matches(HTTP_URL_OR_EMPTY, {
    message: 'customLinkUrl must start with http:// or https://',
  })
  customLinkUrl?: string;
  @IsOptional() @IsString() @MaxLength(20) customLinkLabel?: string;

  // JSON-encoded arrays — service does JSON.parse
  @IsOptional() @IsString() existingGalleryImages?: string;
  @IsOptional() @IsString() existingGalleryVideos?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) existingPrimaryImage?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) existingLogo?: string;

  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() showOnlineMembers?: string;

  @IsOptional() @IsIn(['DRAFT', 'PRIVATE', 'PUBLIC']) status?: string;
}

// Owner-only payment fields. Separate endpoint so cancellation / price
// edits don't go through the general community update path.
export class UpdatePaymentInfoDto {
  @IsOptional() @IsString() price?: string;
  // ISO date string when the owner-initiated subscription cancellation takes
  // effect. Pass null to clear (un-cancel). The cron handles the actual
  // SUSPENDED flip at the scheduled date.
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
