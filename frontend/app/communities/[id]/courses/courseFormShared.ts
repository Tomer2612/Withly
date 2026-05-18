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
