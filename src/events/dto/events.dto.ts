import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RsvpStatus } from '@prisma/client';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const URL_MAX = 1000;

// Multipart body for create. All fields arrive as strings; service does
// the date/number/boolean conversions.
export class CreateEventDto {
  @IsString() @MinLength(1) @MaxLength(TITLE_MAX) title!: string;
  @IsString() date!: string;

  @IsOptional() @IsString() @MaxLength(DESCRIPTION_MAX) description?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string;
  @IsOptional() @IsString() isRecurring?: string;
  @IsOptional() @IsIn(['daily', 'weekly', 'monthly']) recurringType?: string;
  @IsOptional() @IsIn(['online', 'physical']) locationType?: string;
  @IsOptional() @IsString() @MaxLength(200) locationName?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) locationUrl?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @IsString() capacity?: string;
  @IsOptional() @IsString() sendReminders?: string;
  @IsOptional() @IsString() reminderDays?: string;
  @IsOptional() @IsIn(['all', 'managers']) attendeeType?: string;
}

// Multipart body for update — same shape as create, all optional.
export class UpdateEventDto {
  @IsOptional() @IsString() @MaxLength(TITLE_MAX) title?: string;
  @IsOptional() @IsString() @MaxLength(DESCRIPTION_MAX) description?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string;
  @IsOptional() @IsString() isRecurring?: string;
  @IsOptional() @IsIn(['daily', 'weekly', 'monthly']) recurringType?: string;
  @IsOptional() @IsIn(['online', 'physical']) locationType?: string;
  @IsOptional() @IsString() @MaxLength(200) locationName?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) locationUrl?: string;
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @IsString() capacity?: string;
  @IsOptional() @IsString() sendReminders?: string;
  @IsOptional() @IsString() reminderDays?: string;
  @IsOptional() @IsIn(['all', 'managers']) attendeeType?: string;
}

export class RsvpEventDto {
  @IsEnum(RsvpStatus)
  status!: RsvpStatus;
}
