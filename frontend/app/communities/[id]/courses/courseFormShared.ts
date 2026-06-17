/**
 * Shared course-form constants used by both the create and edit pages
 * (`create/page.tsx`, `[courseId]/edit/page.tsx`).
 *
 * These are the only values that are genuinely identical between the two
 * pages and safe to share verbatim. Types, validation, and the chapter/
 * lesson editor UI deliberately differ between create and edit (soft-delete,
 * snapshot dirty-detection, newImage vs image, etc.) and are NOT unified
 * here — see the course-pages-tech-debt memory for the staged plan.
 */

export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_CHAPTER_TITLE_LENGTH = 80;
export const MAX_LESSON_TITLE_LENGTH = 80;
export const MAX_LESSON_DURATION = 480; // 8 hours max
export const MIN_LESSON_DURATION = 1;

import { isValidVideoUrl } from '@/app/lib/videoUtils';

const LINK_URL_RE =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

export type AddLinkResult =
  | { kind: 'error'; message: string; autoClear?: boolean }
  | { kind: 'video'; url: string }
  | { kind: 'link'; links: string[] };

/**
 * Pure decision for a lesson's "add link" action — shared by create & edit.
 * Returns `null` for empty input (caller treats as no-op). The caller owns
 * all React state (errors map, drafts, updateLesson); this is logic only.
 */
export function addLinkToLesson(
  lesson: { videoUrl?: string | null; links?: string[] | null },
  rawValue: string,
): AddLinkResult | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (!LINK_URL_RE.test(value)) return { kind: 'error', message: 'קישור לא תקין' };
  if (isValidVideoUrl(value)) {
    if (lesson.videoUrl) {
      return { kind: 'error', message: 'ניתן להוסיף סרטון אחד בלבד לשיעור', autoClear: true };
    }
    return { kind: 'video', url: value };
  }
  const links = lesson.links || [];
  if (links.includes(value)) return { kind: 'error', message: 'קישור זה כבר קיים' };
  if (links.length >= 3) return { kind: 'error', message: 'ניתן להוסיף עד 3 קישורים' };
  return { kind: 'link', links: [...links, value] };
}

/**
 * Scroll to (and focus) the first errored field. Shared by create & edit.
 * Canonical = create's version, which includes the `image` branch that
 * edit's local copy was missing (so edit now scrolls to the cover-image
 * error too — a small, intended behaviour fix for edit).
 */
export function scrollToFirstError(errorMap: Record<string, string>): void {
  const errorKeys = Object.keys(errorMap);
  if (errorKeys.length === 0) return;
  const firstErrorKey = errorKeys[0];
  let elementId = '';
  if (firstErrorKey === 'title') elementId = 'course-title';
  else if (firstErrorKey === 'description') elementId = 'course-description';
  else if (firstErrorKey === 'image') elementId = 'course-image-section';
  else if (firstErrorKey === 'chapters') elementId = 'chapters-section';
  else if (firstErrorKey.startsWith('chapter_')) {
    const match = firstErrorKey.match(/chapter_(\d+)/);
    if (match) elementId = `chapter-${match[1]}`;
  } else if (firstErrorKey.startsWith('lesson_')) {
    const match = firstErrorKey.match(/lesson_(\d+)_(\d+)/);
    if (match) elementId = `lesson-${match[1]}-${match[2]}`;
  }
  if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus?.();
    }
  }
}

/**
 * Expand every chapter/lesson that has any validation error in `errors`.
 * Used by both pages' handleSave so that after validation fails, the user
 * lands on something they can actually see (the inline title/duration error
 * banner is inside the expanded block — collapsed lessons would hide it).
 *
 * Generic over the page's ChapterForm/LessonForm; only requires `expanded`
 * + `lessons` shape. Pure function; pages call it inside a setCourse updater.
 */
export function expandChaptersWithErrors<
  L extends { expanded?: boolean },
  C extends { expanded: boolean; lessons: L[] },
>(chapters: C[], errors: Record<string, string>): C[] {
  const errorKeys = Object.keys(errors);
  if (errorKeys.length === 0) return chapters;
  return chapters.map((chapter, ci) => {
    const chapterPrefix = `chapter_${ci}_`;
    const lessonPrefix = `lesson_${ci}_`;
    const chapterHasError = errorKeys.some(
      k => k.startsWith(chapterPrefix) || k.startsWith(lessonPrefix),
    );
    if (!chapterHasError) return chapter;
    const updatedLessons = chapter.lessons.map((lesson, li) => {
      const lessonHit = `lesson_${ci}_${li}_`;
      const lessonHasError = errorKeys.some(k => k.startsWith(lessonHit));
      return lessonHasError ? { ...lesson, expanded: true } : lesson;
    });
    return { ...chapter, expanded: true, lessons: updatedLessons };
  });
}

/* ── Shared validation ──────────────────────────────────────────────────
 * Structural shapes (NOT the pages' CourseForm types) so this stays a pure
 * parameterised function with no cross-module type change. The 3 create/
 * edit divergences are parameters:
 *   - requireImage   create=true (cover image required) / edit=false
 *   - softDelete     edit=true (skip `isDeleted`, raw-index keys) / create=false
 *   - getQuizQuestions  create: l.quiz[]  /  edit: l.quiz?.questions
 * Behaviour is byte-identical to each page's old validateForm given the
 * right params (verified against both bodies).
 */
interface ValidateOption { text: string; isCorrect: boolean }
interface ValidateQuestion {
  question: string;
  questionType: string;
  options: ValidateOption[];
}
interface ValidateLesson {
  title: string;
  duration: number;
  videoUrl?: string | null;
  content?: string | null;
  images?: readonly unknown[] | null;
  imageFiles?: readonly unknown[] | null;
  links?: readonly unknown[] | null;
  lessonType: string;
  isDeleted?: boolean;
  quiz?: unknown;
}
interface ValidateChapter {
  title: string;
  isDeleted?: boolean;
  lessons: ValidateLesson[];
}
export interface ValidateCourse {
  title: string;
  description: string;
  image?: unknown | null;
  chapters: ValidateChapter[];
}
export interface ValidateOpts {
  requireImage: boolean;
  softDelete: boolean;
  getQuizQuestions: (lesson: ValidateLesson) => ValidateQuestion[];
}

export function validateCourseForm(
  course: ValidateCourse,
  { requireImage, softDelete, getQuizQuestions }: ValidateOpts,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const live = (deleted?: boolean) => !(softDelete && deleted);

  if (!course.title.trim()) {
    errors.title = 'שם הקורס הוא שדה חובה';
  } else if (course.title.length > MAX_TITLE_LENGTH) {
    errors.title = `שם הקורס לא יכול להכיל יותר מ-${MAX_TITLE_LENGTH} תווים`;
  }

  if (course.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `התיאור לא יכול להכיל יותר מ-${MAX_DESCRIPTION_LENGTH} תווים`;
  }

  if (requireImage && !course.image) {
    errors.image = 'יש להעלות תמונה לקורס';
  }

  if (course.chapters.filter(c => live(c.isDeleted)).length === 0) {
    errors.chapters = 'יש להוסיף לפחות פרק אחד';
  }

  course.chapters.forEach((chapter, ci) => {
    if (!live(chapter.isDeleted)) return;

    if (!chapter.title.trim()) {
      errors[`chapter_${ci}_title`] = 'שם הפרק הוא שדה חובה';
    } else if (chapter.title.length > MAX_CHAPTER_TITLE_LENGTH) {
      errors[`chapter_${ci}_title`] = `שם הפרק לא יכול להכיל יותר מ-${MAX_CHAPTER_TITLE_LENGTH} תווים`;
    }

    if (chapter.lessons.filter(l => live(l.isDeleted)).length === 0) {
      errors[`chapter_${ci}_lessons`] = 'יש להוסיף לפחות שיעור אחד';
    }

    chapter.lessons.forEach((lesson, li) => {
      if (!live(lesson.isDeleted)) return;

      if (!lesson.title.trim()) {
        errors[`lesson_${ci}_${li}_title`] = 'שם השיעור הוא שדה חובה';
      } else if (lesson.title.length > MAX_LESSON_TITLE_LENGTH) {
        errors[`lesson_${ci}_${li}_title`] = `שם השיעור לא יכול להכיל יותר מ-${MAX_LESSON_TITLE_LENGTH} תווים`;
      }

      if (!lesson.duration || lesson.duration < MIN_LESSON_DURATION) {
        errors[`lesson_${ci}_${li}_duration`] = `משך השיעור חייב להיות לפחות ${MIN_LESSON_DURATION} דקה`;
      } else if (lesson.duration > MAX_LESSON_DURATION) {
        errors[`lesson_${ci}_${li}_duration`] = `משך השיעור לא יכול לעלות על ${MAX_LESSON_DURATION} דקות`;
      }

      if (lesson.videoUrl && lesson.videoUrl.trim()) {
        if (!isValidVideoUrl(lesson.videoUrl.trim())) {
          errors[`lesson_${ci}_${li}_videoUrl`] =
            'קישור לא תקין. יש להזין קישור YouTube, Vimeo, Dailymotion או קובץ MP4';
        }
      }

      if (lesson.lessonType === 'content') {
        const hasVideo = !!lesson.videoUrl;
        const hasText = !!lesson.content?.trim();
        const hasImages =
          (lesson.images && lesson.images.length > 0) ||
          (lesson.imageFiles && lesson.imageFiles.length > 0);
        const hasLinks = lesson.links && lesson.links.length > 0;
        if (!hasVideo && !hasText && !hasImages && !hasLinks) {
          errors[`lesson_${ci}_${li}_content`] = 'שיעור לא יכול להיות ריק מתוכן';
        }
      }

      if (lesson.lessonType === 'quiz') {
        const questions = getQuizQuestions(lesson);
        if (!questions || questions.length === 0) {
          errors[`lesson_${ci}_${li}_quiz`] = 'בוחן חייב להכיל לפחות שאלה אחת';
        } else {
          questions.forEach((question, qi) => {
            if (!question.question.trim()) {
              errors[`lesson_${ci}_${li}_quiz_${qi}_question`] = `שאלה ${qi + 1}: יש להזין טקסט לשאלה`;
            }
            if (question.questionType === 'radio') {
              if (question.options.length < 2) {
                errors[`lesson_${ci}_${li}_quiz_${qi}_options`] = `שאלה ${qi + 1}: נדרשות לפחות 2 אפשרויות`;
              }
              const correctCount = question.options.filter(o => o.isCorrect).length;
              if (correctCount !== 1) {
                errors[`lesson_${ci}_${li}_quiz_${qi}_correct`] = `שאלה ${qi + 1}: יש לבחור תשובה נכונה אחת`;
              }
              question.options.forEach((opt, oi) => {
                if (!opt.text.trim()) {
                  errors[`lesson_${ci}_${li}_quiz_${qi}_opt_${oi}`] = `שאלה ${qi + 1}: אפשרות ${oi + 1} חייבת להכיל טקסט`;
                }
              });
            } else if (question.questionType === 'checkbox') {
              if (question.options.length < 4) {
                errors[`lesson_${ci}_${li}_quiz_${qi}_options`] = `שאלה ${qi + 1}: נדרשות לפחות 4 אפשרויות לבחירה מרובה`;
              }
              const correctCount = question.options.filter(o => o.isCorrect).length;
              if (correctCount < 2) {
                errors[`lesson_${ci}_${li}_quiz_${qi}_correct`] = `שאלה ${qi + 1}: יש לבחור לפחות 2 תשובות נכונות`;
              }
              question.options.forEach((opt, oi) => {
                if (!opt.text.trim()) {
                  errors[`lesson_${ci}_${li}_quiz_${qi}_opt_${oi}`] = `שאלה ${qi + 1}: אפשרות ${oi + 1} חייבת להכיל טקסט`;
                }
              });
            }
          });
        }
      }
    });
  });

  return errors;
}
