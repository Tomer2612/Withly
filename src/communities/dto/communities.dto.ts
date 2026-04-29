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
  @IsOptional() trialCancelled?: boolean;
  @IsOptional() @IsString() @MaxLength(20) cardLastFour?: string;
  @IsOptional() @IsString() @MaxLength(50) cardBrand?: string;
  @IsOptional() @IsString() showOnlineMembers?: string;

  @IsOptional() @IsIn(['DRAFT', 'PRIVATE', 'PUBLIC']) status?: string;
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
