import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const URL_MAX = 1000;

class LessonFileDto {
  @IsString()
  @MaxLength(URL_MAX)
  url!: string;

  @IsString()
  @MaxLength(255)
  name!: string;
}

class QuizOptionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) @MaxLength(500) text!: string;
  @IsBoolean() isCorrect!: boolean;
  @IsInt() @Min(0) order!: number;
}

class QuizQuestionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) @MaxLength(500) question!: string;
  @IsString() @MaxLength(50) questionType!: string;
  @IsInt() @Min(0) order!: number;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options!: QuizOptionDto[];
}

class LessonQuizDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];
}

// Multipart form for course create. communityId rides in the body alongside
// the cover image file. description is required by the schema but the UI
// lets it be blank — accept empty string here to match.
export class CreateCourseDto {
  @IsString() @MinLength(1) @MaxLength(TITLE_MAX) title!: string;
  @IsString() @MaxLength(DESCRIPTION_MAX) description!: string;
  @IsString() @MinLength(1) communityId!: string;
}

// Multipart form for course update — isPublished may arrive as string from
// multipart or boolean from JSON, controller handles both shapes.
export class UpdateCourseDto {
  @IsOptional() @IsString() @MaxLength(TITLE_MAX) title?: string;
  @IsOptional() @IsString() @MaxLength(DESCRIPTION_MAX) description?: string;
  @IsOptional() isPublished?: string | boolean;
}

export class AddChapterDto {
  @IsString() @MinLength(1) @MaxLength(TITLE_MAX) title!: string;
  // Frontend sends order alongside title; service currently ignores it
  // (chapter order is auto-assigned), but accept the field so the
  // request isn't rejected by forbidNonWhitelisted.
  @IsOptional() @IsInt() @Min(0) order?: number;
}

export class UpdateChapterDto {
  @IsOptional() @IsString() @MaxLength(TITLE_MAX) title?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

export class AddLessonDto {
  @IsString() @MinLength(1) @MaxLength(TITLE_MAX) title!: string;
  @IsOptional() @IsString() @MaxLength(50_000) content?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) videoUrl?: string | null;
  @IsOptional() @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsString() @MaxLength(50) lessonType?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(URL_MAX, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LessonFileDto)
  files?: LessonFileDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(URL_MAX, { each: true })
  links?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  contentOrder?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LessonQuizDto)
  quiz?: LessonQuizDto;
}

export class UpdateLessonDto {
  @IsOptional() @IsString() @MaxLength(TITLE_MAX) title?: string;
  @IsOptional() @IsString() @MaxLength(50_000) content?: string;
  @IsOptional() @IsString() @MaxLength(URL_MAX) videoUrl?: string | null;
  @IsOptional() @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsString() @MaxLength(50) lessonType?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(URL_MAX, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LessonFileDto)
  files?: LessonFileDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(URL_MAX, { each: true })
  links?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  contentOrder?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LessonQuizDto)
  quiz?: LessonQuizDto;
}
