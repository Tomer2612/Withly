'use client';

import React, { Fragment } from 'react';
import { compressImages, MAX_IMAGE_SIZE_BYTES } from '../../../lib/imageCompression';
import { MAX_VIDEO_SIZE_BYTES } from '../../../lib/videoUtils';
import { getImageUrl } from '@/app/lib/imageUrl';
import {
  MAX_CHAPTER_TITLE_LENGTH,
  MAX_LESSON_TITLE_LENGTH,
  MAX_LESSON_DURATION,
  MIN_LESSON_DURATION,
} from './courseFormShared';
import PlusIcon from '../../../components/icons/PlusIcon';
import TrashIcon from '../../../components/icons/TrashIcon';
import ChevronUpIcon from '../../../components/icons/ChevronUpIcon';
import ChevronDownIcon from '../../../components/icons/ChevronDownIcon';
import ArrowUpIcon from '../../../components/icons/ArrowUpIcon';
import ArrowDownIcon from '../../../components/icons/ArrowDownIcon';
import CloseIcon from '../../../components/icons/CloseIcon';
import CheckIcon from '../../../components/icons/CheckIcon';
import LinkIcon from '../../../components/icons/LinkIcon';
import VideoOffIcon from '../../../components/icons/VideoOffIcon';
import VideoIcon from '../../../components/icons/VideoIcon';
import FileTextIcon from '../../../components/icons/FileTextIcon';
import FileQuestionIcon from '../../../components/icons/FileQuestionIcon';
import LayersIcon from '../../../components/icons/LayersIcon';
import ImageIcon from '../../../components/icons/ImageIcon';

/**
 * Shared chapters/lessons editor for the course create & edit pages.
 *
 * This is the SUPERSET of both pages' (previously duplicated, ~870-line)
 * chapters JSX. The create/edit divergences are handled so that the shared
 * body is behaviour-identical to each page's old inline block:
 *
 *  - Soft-delete: `isDeleted` skip-render, `activeChapters`/`activeLessons`
 *    counts, and `visibleChapterNumber`/`visibleLessonNumber` display
 *    numbering are edit-only concerns but are *inert for create* (create
 *    never sets `isDeleted` or `id`, so the filters/guards are no-ops and
 *    `visibleX === index + 1`).
 *  - Images: the saved-images list (`lesson.images` via `getImageUrl`) is
 *    edit-only; create's `images` is always empty so that branch renders
 *    nothing and the combined 6-image cap collapses to imageFiles-only.
 *  - Content-type button: edit also clears `quiz: null` when switching to
 *    "content"; create does not. Routed through the `onSelectContentType`
 *    prop so each page keeps its exact original `updateLesson` call.
 *  - Quiz storage shape differs (create: `QuizQuestionForm[]`; edit:
 *    `{ questions: [] } | null`) so quiz access goes through the
 *    `getQuizQuestions` / `setQuizQuestions` adapters.
 *
 * Every other handler/state is supplied by the host page as a prop with the
 * same name it had inline, so the JSX is otherwise a verbatim relocation.
 */
export interface EditorOption { text: string; isCorrect: boolean; order?: number }
export interface EditorQuestion {
  question: string;
  questionType: string;
  order?: number;
  options: EditorOption[];
}
export interface EditorLesson {
  id?: string;
  title: string;
  content: string;
  videoUrl: string;
  duration: number;
  lessonType: string;
  expanded?: boolean;
  isDeleted?: boolean;
  images?: string[];
  imageFiles?: File[];
  files?: { name: string; url: string }[];
  links?: string[];
  contentOrder?: string[];
  quiz?: unknown;
}
export interface EditorChapter {
  id?: string;
  title: string;
  expanded: boolean;
  isDeleted?: boolean;
  lessons: EditorLesson[];
}

interface CourseChaptersEditorProps {
  chapters: EditorChapter[];
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  linkDrafts: Record<string, string>;
  setLinkDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  allChaptersExpanded: boolean;
  setAllChaptersExpanded: (expanded: boolean) => void;
  addChapter: () => void;
  updateChapter: (chapterIndex: number, updates: any) => void;
  removeChapter: (chapterIndex: number) => void;
  toggleChapter: (chapterIndex: number) => void;
  addLesson: (chapterIndex: number) => void;
  updateLesson: (chapterIndex: number, lessonIndex: number, updates: any) => void;
  removeLesson: (chapterIndex: number, lessonIndex: number) => void;
  toggleLesson: (chapterIndex: number, lessonIndex: number) => void;
  handleAddLink: (chapterIndex: number, lessonIndex: number) => void;
  onSelectContentType: (chapterIndex: number, lessonIndex: number) => void;
  getQuizQuestions: (lesson: EditorLesson) => EditorQuestion[];
  setQuizQuestions: (chapterIndex: number, lessonIndex: number, questions: EditorQuestion[]) => void;
}

export default function CourseChaptersEditor({
  chapters,
  errors,
  setErrors,
  linkDrafts,
  setLinkDrafts,
  allChaptersExpanded,
  setAllChaptersExpanded,
  addChapter,
  updateChapter,
  removeChapter,
  toggleChapter,
  addLesson,
  updateLesson,
  removeLesson,
  toggleLesson,
  handleAddLink,
  onSelectContentType,
  getQuizQuestions,
  setQuizQuestions,
}: CourseChaptersEditorProps) {
  // Shim so the relocated JSX can keep its `course.chapters.*` references.
  const course = { chapters };
  // Edit soft-deletes (sets `isDeleted`); create never does, so for create
  // this is just `course.chapters` and every `!isDeleted` guard is a no-op.
  const activeChapters = course.chapters.filter(c => !c.isDeleted);

  return (
            <div id="chapters-section" className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-gray-800">פרקים ושיעורים</h2>
                <div className="flex items-center gap-2">
                  {activeChapters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAllChaptersExpanded(!allChaptersExpanded)}
                      aria-label={allChaptersExpanded ? 'כווץ הכל' : 'פתח הכל'}
                      title={allChaptersExpanded ? 'כווץ הכל' : 'פתח הכל'}
                      className="p-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition"
                    >
                      {allChaptersExpanded ? <ChevronUpIcon size={20} color="#374151" /> : <ChevronDownIcon size={20} color="#374151" />}
                    </button>
                  )}
                  <button
                    onClick={addChapter}
                    className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition font-normal" style={{ fontSize: '16px' }}
                  >
                    הוסף פרק
                    <PlusIcon size={16} color="white" />
                  </button>
                </div>
              </div>

              {errors.chapters && activeChapters.length === 0 && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                  {errors.chapters}
                </div>
              )}

              {activeChapters.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <VideoOffIcon size={24} color="black" />
                  </div>
                  <p className="text-black font-normal text-base sm:text-lg">עדיין אין פרקים בקורס</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {course.chapters.map((chapter, chapterIndex) => {
                    if (chapter.isDeleted) return null;
                    const activeLessons = chapter.lessons.filter(l => !l.isDeleted);
                    // Visible chapter number = count of non-deleted chapters
                    // before this one + 1. For create (nothing deleted) this
                    // is exactly chapterIndex + 1.
                    const visibleChapterNumber = course.chapters.slice(0, chapterIndex).filter(c => !c.isDeleted).length + 1;

                    return (
                    <div key={chapter.id || chapterIndex} id={`chapter-${chapterIndex}`} className="rounded-lg overflow-hidden" style={{ border: '1px solid #7A7A83' }}>
                      {/* Chapter Header */}
                      <div className="p-4 flex items-center gap-3" style={{ backgroundColor: 'black' }}>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={chapter.title}
                            onChange={(e) => {
                              if (e.target.value.length <= MAX_CHAPTER_TITLE_LENGTH) {
                                updateChapter(chapterIndex, { title: e.target.value });
                                if (errors[`chapter_${chapterIndex}_title`]) {
                                  setErrors(prev => ({ ...prev, [`chapter_${chapterIndex}_title`]: '' }));
                                }
                              }
                            }}
                            className={`w-full bg-transparent font-normal text-white focus:outline-none ${
                              errors[`chapter_${chapterIndex}_title`] ? 'ring-1 ring-[#B3261E]' : ''
                            }`}
                            style={{ fontSize: '16px' }}
                            placeholder={`פרק ${visibleChapterNumber}`}
                            maxLength={MAX_CHAPTER_TITLE_LENGTH}
                          />
                          <span className="text-xs block" style={{ color: '#A1A1AA' }}>(לחץ לשנות שם)</span>
                        </div>
                        <span className="font-normal text-white" style={{ fontSize: '16px' }}>
                          {activeLessons.length === 1 ? 'שיעור אחד' : `${activeLessons.length} שיעורים`}
                        </span>
                        <button
                          onClick={() => toggleChapter(chapterIndex)}
                          className="p-2 hover:bg-gray-700 rounded transition"
                        >
                          {chapter.expanded ? (
                            <ChevronUpIcon size={16} color="white" />
                          ) : (
                            <ChevronDownIcon size={16} color="white" />
                          )}
                        </button>
                        <button
                          onClick={() => removeChapter(chapterIndex)}
                          className="p-2 hover:bg-gray-700 rounded transition"
                        >
                          <TrashIcon size={16} color="white" />
                        </button>
                      </div>

                      {errors[`chapter_${chapterIndex}_title`] && (
                        <div className="m-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                          {errors[`chapter_${chapterIndex}_title`]}
                        </div>
                      )}

                      {errors[`chapter_${chapterIndex}_lessons`] && activeLessons.length === 0 && (
                        <div className="m-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                          {errors[`chapter_${chapterIndex}_lessons`]}
                        </div>
                      )}

                      {/* Chapter Lessons */}
                      {chapter.expanded && (
                        <div className="p-4" style={{ backgroundColor: '#F4F4F5', borderTop: '1px solid #7A7A83' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                          {chapter.lessons.map((lesson, lessonIndex) => {
                            if (lesson.isDeleted) return null;
                            // Visible lesson number = count of non-deleted
                            // lessons before this one + 1. For create this is
                            // exactly lessonIndex + 1 (so first visible === 0).
                            const visibleLessonNumber = chapter.lessons.slice(0, lessonIndex).filter(l => !l.isDeleted).length + 1;
                            const isFirstVisibleLesson = visibleLessonNumber === 1;
                            const quizQuestions = getQuizQuestions(lesson);
                            const hasMultipleContent = [
                              lesson.videoUrl,
                              lesson.content,
                              (lesson.images?.length ?? 0) > 0 || (lesson.imageFiles?.length ?? 0) > 0,
                              (lesson.files?.length ?? 0) > 0,
                              (lesson.links?.length ?? 0) > 0,
                            ].filter(Boolean).length > 1;

                            // Determine lesson type icon and label
                            const getLessonIcon = () => {
                              if (lesson.lessonType === 'quiz') return <FileQuestionIcon size={16} color="#6B7280" />;
                              if (hasMultipleContent) return <LayersIcon size={16} color="#6B7280" />;
                              if (lesson.videoUrl) return <VideoIcon size={16} color="#6B7280" />;
                              if ((lesson.links?.length ?? 0) > 0) return <LinkIcon size={16} color="#6B7280" />;
                              if ((lesson.images?.length ?? 0) > 0 || (lesson.imageFiles?.length ?? 0) > 0) return <ImageIcon size={16} color="#6B7280" />;
                              return <FileTextIcon size={16} color="#6B7280" />;
                            };

                            const getLessonTypeLabel = () => {
                              if (lesson.lessonType === 'quiz') return 'בוחן';
                              return 'שיעור';
                            };

                            return (
                            <Fragment key={lesson.id || lessonIndex}>
                            <div id={`lesson-${chapterIndex}-${lessonIndex}`} className="px-4" style={{ paddingTop: isFirstVisibleLesson ? '4px' : '12px', paddingBottom: '12px', borderTop: !isFirstVisibleLesson ? '1px solid #D0D0D4' : 'none' }}>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {getLessonIcon()}
                                  <span className="font-normal text-black" style={{ fontSize: '16px' }}>{getLessonTypeLabel()} {visibleLessonNumber}</span>
                                </div>
                                <div className="mr-auto flex items-center gap-1">
                                  <button
                                    onClick={() => toggleLesson(chapterIndex, lessonIndex)}
                                    className="p-1.5 hover:bg-gray-100 rounded transition"
                                  >
                                    {lesson.expanded !== false ? (
                                      <ChevronUpIcon size={14} color="black" />
                                    ) : (
                                      <ChevronDownIcon size={14} color="black" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => removeLesson(chapterIndex, lessonIndex)}
                                    className="p-1.5 hover:bg-gray-100 rounded transition"
                                  >
                                    <TrashIcon size={14} color="black" />
                                  </button>
                                </div>
                              </div>

                              {lesson.expanded !== false && (
                              <>
                              {/* Lesson Type Selector */}
                              <div className="mb-3 mt-3" style={{ marginBottom: '20px' }}>
                                <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>סוג שיעור</label>
                                <div className="flex" style={{ gap: '16px' }}>
                                  <button
                                    type="button"
                                    onClick={() => onSelectContentType(chapterIndex, lessonIndex)}
                                    className="flex-1 py-2 px-3 rounded-lg font-normal transition"
                                    style={{
                                      fontSize: '16px',
                                      backgroundColor: lesson.lessonType === 'content' ? 'black' : '#D0D0D4',
                                      color: lesson.lessonType === 'content' ? 'white' : '#A1A1AA'
                                    }}
                                  >
                                    תוכן
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateLesson(chapterIndex, lessonIndex, { lessonType: 'quiz' });
                                      if (quizQuestions.length === 0) {
                                        setQuizQuestions(chapterIndex, lessonIndex, [{
                                          question: '',
                                          questionType: 'radio' as const,
                                          order: 0,
                                          options: [
                                            { text: '', isCorrect: true, order: 0 },
                                            { text: '', isCorrect: false, order: 1 },
                                          ],
                                        }]);
                                      }
                                    }}
                                    className="flex-1 py-2 px-3 rounded-lg font-normal transition"
                                    style={{
                                      fontSize: '16px',
                                      backgroundColor: lesson.lessonType === 'quiz' ? 'black' : '#D0D0D4',
                                      color: lesson.lessonType === 'quiz' ? 'white' : '#A1A1AA'
                                    }}
                                  >
                                    בוחן
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2" style={{ marginBottom: '20px', gap: '16px' }}>
                                <div>
                                  <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>כותרת <span style={{ color: '#B3261E' }}>*</span></label>
                                  <input
                                    type="text"
                                    value={lesson.title}
                                    onChange={(e) => {
                                      if (e.target.value.length <= MAX_LESSON_TITLE_LENGTH) {
                                        updateLesson(chapterIndex, lessonIndex, { title: e.target.value });
                                        if (errors[`lesson_${chapterIndex}_${lessonIndex}_title`]) {
                                          setErrors(prev => ({ ...prev, [`lesson_${chapterIndex}_${lessonIndex}_title`]: '' }));
                                        }
                                      }
                                    }}
                                    className={`w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                                      errors[`lesson_${chapterIndex}_${lessonIndex}_title`] ? 'border-[#B3261E]' : 'border-gray-300'
                                    }`}
                                    placeholder="כותרת השיעור"
                                    maxLength={MAX_LESSON_TITLE_LENGTH}
                                  />
                                  {errors[`lesson_${chapterIndex}_${lessonIndex}_title`] && (
                                    <div className="mt-1 p-2 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                                      {errors[`lesson_${chapterIndex}_${lessonIndex}_title`]}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>משך (דקות) <span style={{ color: '#B3261E' }}>*</span></label>
                                  <input
                                    type="number"
                                    value={lesson.duration}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      if (val >= 0 && val <= MAX_LESSON_DURATION) {
                                        updateLesson(chapterIndex, lessonIndex, { duration: val });
                                        if (errors[`lesson_${chapterIndex}_${lessonIndex}_duration`]) {
                                          setErrors(prev => ({ ...prev, [`lesson_${chapterIndex}_${lessonIndex}_duration`]: '' }));
                                        }
                                      }
                                    }}
                                    className={`w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                                      errors[`lesson_${chapterIndex}_${lessonIndex}_duration`] ? 'border-[#B3261E]' : 'border-gray-300'
                                    }`}
                                    min={MIN_LESSON_DURATION}
                                    max={MAX_LESSON_DURATION}
                                  />
                                  {errors[`lesson_${chapterIndex}_${lessonIndex}_duration`] && (
                                    <div className="mt-1 p-2 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                                      {errors[`lesson_${chapterIndex}_${lessonIndex}_duration`]}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Content Type Lesson */}
                              {lesson.lessonType === 'content' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  {/* Content empty error */}
                                  {errors[`lesson_${chapterIndex}_${lessonIndex}_content`] && (
                                    <div className="mt-1 p-2 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                                      {errors[`lesson_${chapterIndex}_${lessonIndex}_content`]}
                                    </div>
                                  )}
                                  {/* Content Order Section */}
                                  <div className="rounded-lg p-3">
                                    <label className="block text-black font-normal mb-2" style={{ fontSize: '14px' }}>
                                      סדר תצוגת התוכן
                                    </label>
                                    <div className="space-y-1">
                                      {(lesson.contentOrder || ['video', 'links', 'images', 'text']).map((item, orderIndex) => {
                                        const labels: Record<string, string> = { video: 'סרטון', text: 'טקסט', images: 'תמונות', links: 'קישורים' };
                                        const icons: Record<string, React.ReactNode> = {
                                          video: <VideoIcon size={16} />,
                                          text: <FileTextIcon size={16} />,
                                          images: <ImageIcon size={16} />,
                                          links: <LinkIcon size={16} />
                                        };
                                        return (
                                          <div
                                            key={item}
                                            className="flex items-center bg-white rounded-full overflow-hidden"
                                            style={{ border: '1px solid var(--color-gray-4)' }}
                                          >
                                            {/* Number with light blue background on left side */}
                                            <div className="flex items-center self-stretch px-3 py-1" style={{ backgroundColor: '#C7F1FA', minWidth: '32px' }}>
                                              <span className="text-black font-normal" style={{ fontSize: '14px' }}>{orderIndex + 1}</span>
                                            </div>
                                            {/* Icon between number and label */}
                                            <span className="text-black mr-2 ml-2">{icons[item]}</span>
                                            {/* Label */}
                                            <span className="text-black font-normal" style={{ fontSize: '14px' }}>{labels[item]}</span>
                                            {/* Arrows on right side - down before up */}
                                            <div className="mr-auto flex gap-1 px-2">
                                              <button
                                                type="button"
                                                disabled={orderIndex === (lesson.contentOrder || ['video', 'links', 'images', 'text']).length - 1}
                                                onClick={() => {
                                                  const currentOrder = lesson.contentOrder || ['video', 'links', 'images', 'text'];
                                                  const newOrder = [...currentOrder];
                                                  [newOrder[orderIndex], newOrder[orderIndex + 1]] = [newOrder[orderIndex + 1], newOrder[orderIndex]];
                                                  updateLesson(chapterIndex, lessonIndex, { contentOrder: newOrder });
                                                }}
                                                className="p-1"
                                              >
                                                <ArrowDownIcon size={12} color={orderIndex === (lesson.contentOrder || ['video', 'links', 'images', 'text']).length - 1 ? '#D0D0D4' : 'black'} />
                                              </button>
                                              <button
                                                type="button"
                                                disabled={orderIndex === 0}
                                                onClick={() => {
                                                  const currentOrder = lesson.contentOrder || ['video', 'links', 'images', 'text'];
                                                  const newOrder = [...currentOrder];
                                                  [newOrder[orderIndex - 1], newOrder[orderIndex]] = [newOrder[orderIndex], newOrder[orderIndex - 1]];
                                                  updateLesson(chapterIndex, lessonIndex, { contentOrder: newOrder });
                                                }}
                                                className="p-1"
                                              >
                                                <ArrowUpIcon size={12} color={orderIndex === 0 ? '#D0D0D4' : 'black'} />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Video */}
                                  <div>
                                    <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>
                                      סרטון <span className="text-gray-400">(אופציונלי)</span>
                                    </label>
                                    {/* Current video display */}
                                    {lesson.videoUrl && (
                                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 mb-2">
                                        <VideoIcon size={12} color="#6B7280" />
                                        <span className="text-sm text-gray-700 truncate flex-1" dir="ltr">{lesson.videoUrl}</span>
                                        <span className="text-xs text-gray-400">(1/1)</span>
                                        <button
                                          type="button"
                                          onClick={() => updateLesson(chapterIndex, lessonIndex, { videoUrl: '' })}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          <CloseIcon size={14} color="currentColor" />
                                        </button>
                                      </div>
                                    )}
                                    {/* Video file upload */}
                                    <div>
                                      <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/quicktime"
                                        className="hidden"
                                        id={`video-upload-${chapterIndex}-${lessonIndex}`}
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const videoErrKey = `lesson_${chapterIndex}_${lessonIndex}_videoUrl`;
                                            if (lesson.videoUrl) {
                                              setErrors(prev => ({ ...prev, [videoErrKey]: 'ניתן להוסיף סרטון אחד בלבד לשיעור' }));
                                              setTimeout(() => setErrors(prev => { const n = { ...prev }; delete n[videoErrKey]; return n; }), 5000);
                                              e.target.value = '';
                                              return;
                                            }
                                            if (!file.type.startsWith('video/')) {
                                              setErrors(prev => ({ ...prev, [videoErrKey]: 'ניתן להעלות רק קבצי וידאו' }));
                                              setTimeout(() => setErrors(prev => { const n = { ...prev }; delete n[videoErrKey]; return n; }), 5000);
                                              e.target.value = '';
                                              return;
                                            }
                                            if (file.size > MAX_VIDEO_SIZE_BYTES) {
                                              setErrors(prev => ({ ...prev, [videoErrKey]: 'גודל הקובץ חורג מ-100MB' }));
                                              setTimeout(() => setErrors(prev => { const n = { ...prev }; delete n[videoErrKey]; return n; }), 5000);
                                              e.target.value = '';
                                              return;
                                            }
                                            setErrors(prev => { const n = { ...prev }; delete n[`lesson_${chapterIndex}_${lessonIndex}_videoUrl`]; return n; });
                                            try {
                                              const formData = new FormData();
                                              formData.append('video', file);
                                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/lessons/upload-video`, {
                                                method: 'POST',
                                                body: formData,
                                              });
                                              if (res.ok) {
                                                const data = await res.json();
                                                updateLesson(chapterIndex, lessonIndex, { videoUrl: data.url });
                                              }
                                            } catch {}
                                          }
                                          e.target.value = '';
                                        }}
                                      />
                                      <label
                                        htmlFor={`video-upload-${chapterIndex}-${lessonIndex}`}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition text-sm text-gray-600"
                                      >
                                        <VideoIcon size={16} color="#6B7280" />
                                        העלאת סרטון (עד 100MB)
                                      </label>
                                      {errors[`lesson_${chapterIndex}_${lessonIndex}_videoUrl`] && (
                                        <div className="mt-1 p-2 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                                          {errors[`lesson_${chapterIndex}_${lessonIndex}_videoUrl`]}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* Links */}
                                  <div>
                                    <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>
                                      קישורים <span className="text-gray-400">(אופציונלי)</span>
                                    </label>
                                    {/* Current links display */}
                                    {(lesson.links || []).length > 0 && (
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {(lesson.links || []).map((link, linkIndex) => (
                                          <div key={linkIndex} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1 border border-gray-200">
                                            <LinkIcon size={12} color="#6B7280" />
                                            <span className="text-sm text-gray-700 max-w-[200px] truncate" dir="ltr">{link}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newLinks = (lesson.links || []).filter((_, i) => i !== linkIndex);
                                                updateLesson(chapterIndex, lessonIndex, { links: newLinks });
                                              }}
                                              className="text-gray-400 hover:text-gray-600"
                                            >
                                              <CloseIcon size={14} color="currentColor" />
                                            </button>
                                          </div>
                                        ))}
                                        <span className="text-xs text-gray-400 self-center">({(lesson.links || []).length}/3)</span>
                                      </div>
                                    )}
                                    {/* Link input */}
                                    <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                                      <input
                                        type="text"
                                        className="flex-1 p-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                                        placeholder="הדבק קישור (YouTube, Vimeo, או כל קישור אחר)"
                                        value={linkDrafts[`${chapterIndex}-${lessonIndex}`] || ''}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setLinkDrafts(prev => ({ ...prev, [`${chapterIndex}-${lessonIndex}`]: v }));
                                          setErrors(prev => { const n = { ...prev }; delete n[`link_${chapterIndex}_${lessonIndex}`]; return n; });
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddLink(chapterIndex, lessonIndex);
                                          }
                                        }}
                                      />
                                      {(() => {
                                        const hasDraft = (linkDrafts[`${chapterIndex}-${lessonIndex}`] || '').trim().length > 0;
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => handleAddLink(chapterIndex, lessonIndex)}
                                            disabled={!hasDraft}
                                            className="px-3 py-2 rounded-full text-sm transition"
                                            style={{ backgroundColor: hasDraft ? '#91DCED' : '#c4ebf5', color: hasDraft ? 'black' : '#A1A1AA', fontSize: '14px', cursor: hasDraft ? 'pointer' : 'not-allowed' }}
                                          >
                                            הוסף
                                          </button>
                                        );
                                      })()}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLinkDrafts(prev => ({ ...prev, [`${chapterIndex}-${lessonIndex}`]: '' }));
                                          setErrors(prev => { const n = { ...prev }; delete n[`link_${chapterIndex}_${lessonIndex}`]; return n; });
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-600"
                                      >
                                        <CloseIcon size={16} color="currentColor" />
                                      </button>
                                    </div>
                                    {errors[`link_${chapterIndex}_${lessonIndex}`] && (
                                      <div className="mt-1 p-2 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                                        {errors[`link_${chapterIndex}_${lessonIndex}`]}
                                      </div>
                                    )}
                                  </div>
                                  {/* Images */}
                                  <div>
                                    <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>
                                      תמונות <span className="text-gray-400">(אופציונלי)</span>
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {(lesson.images || []).map((imageUrl, imgIndex) => (
                                        <div key={`saved-${imgIndex}`} className="relative group">
                                          <img
                                            src={getImageUrl(imageUrl)}
                                            alt={`תמונה ${imgIndex + 1}`}
                                            className="w-full h-24 object-cover rounded-lg"
                                          />
                                          <div className="absolute inset-0 bg-black/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newImages = (lesson.images || []).filter((_, i) => i !== imgIndex);
                                                updateLesson(chapterIndex, lessonIndex, { images: newImages });
                                              }}
                                              className="font-medium flex items-center justify-center"
                                              style={{
                                                backgroundColor: '#B3261E',
                                                color: 'white',
                                                fontSize: '12px',
                                                width: '67px',
                                                height: '20px',
                                                borderRadius: '9999px'
                                              }}
                                            >
                                              הסר תמונה
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                      {(lesson.imageFiles || []).map((file, imgIndex) => (
                                        <div key={`new-${imgIndex}`} className="relative group">
                                          <img
                                            src={URL.createObjectURL(file)}
                                            alt={file.name}
                                            className="w-full h-24 object-cover rounded-lg"
                                          />
                                          <div className="absolute inset-0 bg-black/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newFiles = (lesson.imageFiles || []).filter((_, i) => i !== imgIndex);
                                                updateLesson(chapterIndex, lessonIndex, { imageFiles: newFiles });
                                              }}
                                              className="font-medium flex items-center justify-center"
                                              style={{
                                                backgroundColor: '#B3261E',
                                                color: 'white',
                                                fontSize: '12px',
                                                width: '67px',
                                                height: '20px',
                                                borderRadius: '9999px'
                                              }}
                                            >
                                              הסר תמונה
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                      {((lesson.images || []).length + (lesson.imageFiles || []).length) < 6 && (
                                        <label className="flex flex-col items-center justify-center h-24 rounded-lg cursor-pointer hover:bg-gray-50 transition" style={{ border: '1px dashed #D0D0D4' }}>
                                          <ImageIcon size={20} color="#9CA3AF" className="mb-1" />
                                          <span className="text-xs text-gray-500">לחץ להעלאת תמונות (עד 20MB)</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={async (e) => {
                                              const files = e.target.files;
                                              if (!files || files.length === 0) return;

                                              const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                                              if (imageFiles.length < files.length) {
                                                setErrors(prev => ({ ...prev, [`lesson_${chapterIndex}_${lessonIndex}_images`]: 'ניתן להעלות רק קבצי תמונה' }));
                                              }
                                              // Filter out oversized images
                                              const validImages = imageFiles.filter(f => f.size <= MAX_IMAGE_SIZE_BYTES);
                                              if (validImages.length < imageFiles.length) {
                                                setErrors(prev => ({ ...prev, [`lesson_${chapterIndex}_${lessonIndex}_images`]: 'חלק מהתמונות חורגות מ-20MB' }));
                                              }
                                              if (validImages.length === 0) {
                                                e.target.value = '';
                                                return;
                                              }

                                              const currentCount = (lesson.imageFiles || []).length + (lesson.images || []).length;
                                              const maxAllowed = 6 - currentCount;
                                              if (maxAllowed <= 0) {
                                                setErrors(prev => ({ ...prev, [`lesson_${chapterIndex}_${lessonIndex}_images`]: 'ניתן להעלות עד 6 תמונות' }));
                                                e.target.value = '';
                                                return;
                                              }

                                              setErrors(prev => { const n = { ...prev }; delete n[`lesson_${chapterIndex}_${lessonIndex}_images`]; return n; });
                                              const filesToProcess = validImages.slice(0, maxAllowed);
                                              const compressedFiles = await compressImages(filesToProcess);

                                              updateLesson(chapterIndex, lessonIndex, {
                                                imageFiles: [...(lesson.imageFiles || []), ...compressedFiles]
                                              });
                                              e.target.value = '';
                                            }}
                                          />
                                        </label>
                                      )}
                                    </div>
                                    {errors[`lesson_${chapterIndex}_${lessonIndex}_images`] && (
                                      <div className="mt-1 p-2 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                                        {errors[`lesson_${chapterIndex}_${lessonIndex}_images`]}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>
                                      תוכן השיעור <span className="text-gray-400">(אופציונלי)</span>
                                    </label>
                                    <textarea
                                      value={lesson.content}
                                      onChange={(e) => updateLesson(chapterIndex, lessonIndex, { content: e.target.value })}
                                      rows={3}
                                      className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right"
                                      style={{ resize: 'none' }}
                                      placeholder="תוכן טקסט לשיעור..."
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Quiz Type Lesson */}
                              {lesson.lessonType === 'quiz' && (
                                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  <div className="rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <label className="block text-black font-normal" style={{ fontSize: '16px' }}>
                                        שאלות הבוחן
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newQuiz = [...quizQuestions, {
                                            question: '',
                                            questionType: 'radio' as const,
                                            order: quizQuestions.length,
                                            options: [
                                              { text: '', isCorrect: true, order: 0 },
                                              { text: '', isCorrect: false, order: 1 },
                                            ],
                                          }];
                                          setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                        }}
                                        className="bg-black text-white px-3 py-1 rounded hover:bg-gray-800 flex items-center gap-2"
                                        style={{ fontSize: '14px' }}
                                      >
                                        הוסף שאלה
                                        <PlusIcon size={12} color="white" />
                                      </button>
                                    </div>

                                    <div className="space-y-4">
                                      {quizQuestions.length === 0 && (
                                        <div className="text-center py-6 text-gray-500" style={{ fontSize: '14px' }}>
                                          אין שאלות בבוחן. לחץ על "הוסף שאלה" כדי להתחיל.
                                        </div>
                                      )}
                                      {quizQuestions.map((question, qIndex) => (
                                          <div key={qIndex} className="bg-white rounded-lg p-3" style={{ border: '1px solid #E1E1E2' }}>
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-black font-normal" style={{ fontSize: '14px' }}>
                                                {qIndex + 1}.
                                              </span>
                                              <div className="flex-1">
                                                <input
                                                  type="text"
                                                  value={question.question}
                                                  onChange={(e) => {
                                                    const newQuiz = [...quizQuestions];
                                                    newQuiz[qIndex] = { ...newQuiz[qIndex], question: e.target.value };
                                                    setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                  }}
                                                  className={`w-full p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                                                    errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_question`]
                                                      ? 'border-[#B3261E]'
                                                      : ''
                                                  }`}
                                                  style={{ fontSize: '14px', border: '0.5px solid #D0D0D4' }}
                                                  placeholder="הקלד את השאלה..."
                                                />
                                                {errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_question`] && (
                                                  <span className="text-xs" style={{ color: '#B3261E' }}>{errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_question`]}</span>
                                                )}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQuiz = quizQuestions.filter((_, i) => i !== qIndex);
                                                  setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded"
                                              >
                                                <TrashIcon size={14} color="#7A7A83" />
                                              </button>
                                            </div>

                                            {/* Question Type */}
                                            <div className="flex gap-2 mb-2 mr-5">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQuiz = [...quizQuestions];
                                                  const currentOptions = newQuiz[qIndex].options || [];
                                                  // Trim to 2 options when switching to radio (keep first 2)
                                                  let newOptions = currentOptions.slice(0, 2);
                                                  // Ensure we have at least 2 options
                                                  while (newOptions.length < 2) {
                                                    newOptions.push({ text: '', isCorrect: false, order: newOptions.length });
                                                  }
                                                  // Make sure only one is correct (keep the first correct one, or select first if none)
                                                  const hasCorrect = newOptions.some(o => o.isCorrect);
                                                  if (!hasCorrect) {
                                                    // Auto-select first option
                                                    newOptions[0] = { ...newOptions[0], isCorrect: true };
                                                  } else {
                                                    // Keep only the first correct one
                                                    let foundCorrect = false;
                                                    newOptions = newOptions.map(o => {
                                                      if (o.isCorrect && !foundCorrect) {
                                                        foundCorrect = true;
                                                        return o;
                                                      }
                                                      return { ...o, isCorrect: false };
                                                    });
                                                  }
                                                  newQuiz[qIndex] = { ...newQuiz[qIndex], questionType: 'radio', options: newOptions };
                                                  setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                }}
                                                className="px-3 py-1 rounded-lg font-normal transition"
                                                style={{
                                                  fontSize: '14px',
                                                  backgroundColor: question.questionType === 'radio' ? 'black' : '#D0D0D4',
                                                  color: question.questionType === 'radio' ? 'white' : '#A1A1AA'
                                                }}
                                              >
                                                בחירה יחידה
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQuiz = [...quizQuestions];
                                                  const currentOptions = newQuiz[qIndex].options || [];
                                                  // Keep existing options and add to reach 4 if needed
                                                  const newOptions = [...currentOptions];
                                                  // Add options to reach 4 if less than 4
                                                  while (newOptions.length < 4) {
                                                    newOptions.push({ text: '', isCorrect: false, order: newOptions.length });
                                                  }
                                                  // Set first 2 options as correct by default for multiple choice
                                                  newOptions[0] = { ...newOptions[0], isCorrect: true };
                                                  newOptions[1] = { ...newOptions[1], isCorrect: true };
                                                  newQuiz[qIndex] = { ...newQuiz[qIndex], questionType: 'checkbox', options: newOptions };
                                                  setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                }}
                                                className="px-3 py-1 rounded-lg font-normal transition"
                                                style={{
                                                  fontSize: '14px',
                                                  backgroundColor: question.questionType === 'checkbox' ? 'black' : '#D0D0D4',
                                                  color: question.questionType === 'checkbox' ? 'white' : '#A1A1AA'
                                                }}
                                              >
                                                בחירה מרובה
                                              </button>
                                            </div>

                                            {/* Question type hints */}
                                            <p className="text-xs mb-2 mr-5" style={{ color: '#A1A1AA' }}>
                                              {question.questionType === 'radio'
                                                ? 'בחירה יחידה - המשתמש יכול לבחור תשובה אחת בלבד.'
                                                : 'בחירה מרובה - המשתמש יכול לבחור מספר תשובות.'}
                                            </p>

                                            {/* Show validation errors for this question */}
                                            {errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_options`] && (
                                              <div className="text-xs mb-2 mr-5" style={{ color: '#B3261E' }}>
                                                {errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_options`]}
                                              </div>
                                            )}
                                            {errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_correct`] && (
                                              <div className="text-xs mb-2 mr-5" style={{ color: '#B3261E' }}>
                                                {errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_correct`]}
                                              </div>
                                            )}

                                            {/* Options */}
                                            <div className="space-y-2 mr-5">
                                              {question.options.map((option, oIndex) => (
                                                <div key={oIndex}>
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const newQuiz = [...quizQuestions];
                                                        if (question.questionType === 'radio') {
                                                          // For radio, only one can be correct
                                                          newQuiz[qIndex].options = question.options.map((o, i) => ({
                                                            ...o,
                                                            isCorrect: i === oIndex,
                                                          }));
                                                        } else {
                                                          // For checkbox: don't allow unchecking if only 2 correct answers remain
                                                          const correctCount = question.options.filter(o => o.isCorrect).length;
                                                          if (option.isCorrect && correctCount <= 2) {
                                                            // Don't allow unchecking - minimum 2 correct answers required
                                                            return;
                                                          }
                                                          newQuiz[qIndex].options[oIndex] = {
                                                            ...option,
                                                            isCorrect: !option.isCorrect,
                                                          };
                                                        }
                                                        setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                      }}
                                                      className="w-4 h-4 rounded-full flex items-center justify-center"
                                                      style={{
                                                        backgroundColor: option.isCorrect ? '#A7EA7B' : 'transparent',
                                                        border: option.isCorrect ? 'none' : '1px solid black'
                                                      }}
                                                    >
                                                      {option.isCorrect && <CheckIcon size={10} color="black" />}
                                                    </button>
                                                    <input
                                                      type="text"
                                                      value={option.text}
                                                      onChange={(e) => {
                                                        const newQuiz = [...quizQuestions];
                                                        newQuiz[qIndex].options[oIndex] = {
                                                          ...option,
                                                          text: e.target.value,
                                                        };
                                                        setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                      }}
                                                      className={`flex-1 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                                                        errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_opt_${oIndex}`]
                                                          ? 'border-[#B3261E]'
                                                          : ''
                                                      }`}
                                                      style={{ fontSize: '14px', border: '0.5px solid #D0D0D4' }}
                                                      placeholder={`אפשרות ${oIndex + 1}`}
                                                    />
                                                    {((question.questionType === 'radio' && question.options.length > 2) ||
                                                      (question.questionType === 'checkbox' && question.options.length > 4)) && (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          const newQuiz = [...quizQuestions];
                                                          newQuiz[qIndex].options = question.options.filter((_, i) => i !== oIndex);
                                                          setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                        }}
                                                        className="p-1 hover:bg-gray-100 rounded"
                                                      >
                                                        <CloseIcon size={12} color="#7A7A83" />
                                                      </button>
                                                    )}
                                                  </div>
                                                  {errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_opt_${oIndex}`] && (
                                                    <span className="text-xs mr-7" style={{ color: '#B3261E' }}>{errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_opt_${oIndex}`]}</span>
                                                  )}
                                                </div>
                                              ))}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQuiz = [...quizQuestions];
                                                  newQuiz[qIndex].options = [
                                                    ...question.options,
                                                    { text: '', isCorrect: false, order: question.options.length },
                                                  ];
                                                  setQuizQuestions(chapterIndex, lessonIndex, newQuiz);
                                                }}
                                                className="text-black hover:text-gray-700 flex items-center gap-2"
                                                style={{ fontSize: '14px' }}
                                              >
                                                הוסף אפשרות
                                                <PlusIcon size={12} color="black" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                  </div>
                                </div>
                              )}
                              </>
                              )}
                            </div>
                          </Fragment>
                          )})}

                          <button
                            onClick={() => addLesson(chapterIndex)}
                            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition flex items-center justify-center gap-2"
                          >
                            הוסף שיעור
                            <PlusIcon size={16} color="#6B7280" />
                          </button>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}

                  {/* Add Chapter button at the end — solid, distinct from
                      the dashed per-chapter "הוסף שיעור" buttons. */}
                  <button
                    onClick={addChapter}
                    className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition flex items-center justify-center gap-2 font-normal"
                    style={{ fontSize: '16px' }}
                  >
                    הוסף פרק
                    <PlusIcon size={16} color="white" />
                  </button>
                </div>
              )}
            </div>
  );
}
