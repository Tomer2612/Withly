import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const COMMENT_MAX = 5000;
const POST_TITLE_MAX = 200;
const POST_CONTENT_MAX = 10_000;

// Multipart body for post create. Arrays come in as JSON-encoded strings
// (videoUrls, links) — service does the parsing. Files arrive separately.
export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(POST_CONTENT_MAX)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(POST_TITLE_MAX)
  title?: string;

  @IsOptional() @IsString() links?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @IsString() videoUrls?: string;
}

// Multipart body for post update. Same JSON-string array pattern, plus
// optional poll fields.
export class UpdatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(POST_CONTENT_MAX)
  content!: string;

  @IsOptional() @IsString() @MaxLength(POST_TITLE_MAX) title?: string;
  @IsOptional() @IsString() links?: string;
  @IsOptional() @IsString() imagesToRemove?: string;
  @IsOptional() @IsString() filesToRemove?: string;
  @IsOptional() @IsString() linksToRemove?: string;
  @IsOptional() @IsString() videosToRemove?: string;
  @IsOptional() @IsString() videoUrls?: string;
  @IsOptional() @IsString() pollQuestion?: string;
  @IsOptional() @IsString() pollOptions?: string;
  @IsOptional() @IsString() newPollQuestion?: string;
  @IsOptional() @IsString() newPollOptions?: string;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_MAX)
  content!: string;
}

export class EditCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_MAX)
  content!: string;
}

export class CreatePollDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  options!: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class VotePollDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  optionId!: string;
}
