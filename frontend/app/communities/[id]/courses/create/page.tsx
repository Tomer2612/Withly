'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { compressImage, MAX_IMAGE_SIZE_BYTES } from '../../../../lib/imageCompression';
import CommunityNavbar from '../../../../components/CommunityNavbar';
import { useUser } from '../../../../lib/UserContext';
import PlusIcon from '../../../../components/icons/PlusIcon';
import ImageIcon from '../../../../components/icons/ImageIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';
import ClockIcon from '../../../../components/icons/ClockIcon';
import StickySaveBar from '../../../../components/StickySaveBar';
import {
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  addLinkToLesson,
  scrollToFirstError,
  validateCourseForm,
  expandChaptersWithErrors,
} from '../courseFormShared';
import CourseChaptersEditor from '../CourseChaptersEditor';

interface QuizOptionForm {
  id?: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuizQuestionForm {
  id?: string;
  question: string;
  questionType: 'radio' | 'checkbox';
  order: number;
  options: QuizOptionForm[];
}

interface LessonForm {
  id?: string;
  title: string;
  content: string;
  videoUrl: string;
  duration: number;
  order: number;
  isNew?: boolean;
  expanded?: boolean;
  // New fields
  lessonType: 'content' | 'quiz';
  images: string[];
  imageFiles: File[];
  files: { name: string; url: string; size: number; file?: File }[];
  links: string[];
  quiz: QuizQuestionForm[];
  contentOrder: ('video' | 'text' | 'images' | 'links')[];
}

interface ChapterForm {
  id?: string;
  title: string;
  order: number;
  lessons: LessonForm[];
  isNew?: boolean;
  expanded: boolean;
}

interface CourseForm {
  title: string;
  description: string;
  image: File | null;
  imagePreview: string | null;
  chapters: ChapterForm[];
}

export default function CreateCoursePage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [course, setCourse] = useState<CourseForm>({
    title: '',
    description: '',
    image: null,
    imagePreview: null,
    chapters: [],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Draft text for each lesson's link input, keyed `${chapterIndex}-${lessonIndex}`.
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const { user } = useUser();
  const userId = user?.userId ?? null;
  const userEmail = user?.email ?? null;
  const userProfile = user ? { name: user.name, profileImage: user.profileImage } : null;
  const [community, setCommunity] = useState<{ name: string; logo?: string | null } | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Validation constants → ../courseFormShared

  // Format duration in Hebrew
  const formatDurationHebrew = (minutes: number): string => {
    const formatMinutes = (mins: number): string => {
      if (mins === 1) return 'דקה';
      return `${mins} דקות`;
    };

    if (minutes < 60) {
      return formatMinutes(minutes);
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    let hoursText = '';
    if (hours === 1) {
      hoursText = 'שעה';
    } else if (hours === 2) {
      hoursText = 'שעתיים';
    } else {
      hoursText = `${hours} שעות`;
    }
    
    if (remainingMinutes === 0) {
      return hoursText;
    }
    if (remainingMinutes === 1) {
      return `${hoursText} ודקה`;
    }
    return `${hoursText} ו${remainingMinutes} דקות`;
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      (async () => {
        const communityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (!communityRes.ok) return;
        const data = await communityRes.json();
        setCommunity({ name: data.name, logo: data.logo });
        setIsOwner(data.ownerId === user.userId);
      })();
    } catch (e) {
      console.error('Auth probe failed:', e);
      router.push('/login');
    }
  }, [router, communityId, user]);

  const addChapter = () => {
    setCourse(prev => ({
      ...prev,
      chapters: [
        ...prev.chapters.map(c => ({ ...c, expanded: false })),
        {
          title: `פרק ${prev.chapters.length + 1}`,
          order: prev.chapters.length,
          lessons: [
            {
              title: 'שיעור 1',
              content: '',
              videoUrl: '',
              duration: 10,
              order: 0,
              isNew: true,
              expanded: true,
              lessonType: 'content',
              images: [],
              imageFiles: [],
              files: [],
              links: [],
              quiz: [],
              contentOrder: ['video', 'links', 'images', 'text'],
            },
          ],
          isNew: true,
          expanded: true,
        },
      ],
    }));
    // The "at least one chapter" error is now resolved — clear it.
    setErrors(prev => { const n = { ...prev }; delete n.chapters; return n; });
  };

  const setAllChaptersExpanded = (expanded: boolean) => {
    setCourse(prev => ({ ...prev, chapters: prev.chapters.map(c => ({ ...c, expanded })) }));
  };

  const updateChapter = (index: number, updates: Partial<ChapterForm>) => {
    setCourse(prev => ({
      ...prev,
      chapters: prev.chapters.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    }));
  };

  const removeChapter = (index: number) => {
    setCourse(prev => ({
      ...prev,
      chapters: prev.chapters.filter((_, i) => i !== index).map((c, i) => ({ ...c, order: i })),
    }));
  };

  const toggleChapter = (index: number) => {
    updateChapter(index, { expanded: !course.chapters[index].expanded });
  };

  const toggleLesson = (chapterIndex: number, lessonIndex: number) => {
    updateLesson(chapterIndex, lessonIndex, { expanded: !course.chapters[chapterIndex].lessons[lessonIndex].expanded });
  };

  const addLesson = (chapterIndex: number) => {
    setCourse(prev => ({
      ...prev,
      chapters: prev.chapters.map((chapter, i) =>
        i === chapterIndex
          ? {
              ...chapter,
              lessons: [
                ...chapter.lessons,
                {
                  title: `שיעור ${chapter.lessons.length + 1}`,
                  content: '',
                  videoUrl: '',
                  duration: 10,
                  order: chapter.lessons.length,
                  isNew: true,
                  expanded: true,
                  lessonType: 'content',
                  images: [],
                  imageFiles: [],
                  files: [],
                  links: [],
                  quiz: [],
                  contentOrder: ['video', 'links', 'images', 'text'],
                },
              ],
            }
          : chapter
      ),
    }));
    // This chapter now has a lesson — clear its "at least one lesson" error.
    setErrors(prev => {
      const n = { ...prev };
      delete n[`chapter_${chapterIndex}_lessons`];
      return n;
    });
  };

  const updateLesson = (chapterIndex: number, lessonIndex: number, updates: Partial<LessonForm>) => {
    setCourse(prev => ({
      ...prev,
      chapters: prev.chapters.map((chapter, ci) =>
        ci === chapterIndex
          ? {
              ...chapter,
              lessons: chapter.lessons.map((lesson, li) =>
                li === lessonIndex ? { ...lesson, ...updates } : lesson
              ),
            }
          : chapter
      ),
    }));
  };

  // Add a link (or route a video URL to videoUrl) for a lesson. Pure React
  // state — no getElementById/DOM mutation. Error goes to the `errors` map
  // under `link_<ci>_<li>`; the input draft lives in `linkDrafts`.
  const handleAddLink = (chapterIndex: number, lessonIndex: number) => {
    const draftKey = `${chapterIndex}-${lessonIndex}`;
    const errKey = `link_${chapterIndex}_${lessonIndex}`;
    const lesson = course.chapters[chapterIndex]?.lessons[lessonIndex];
    if (!lesson) return;
    const result = addLinkToLesson(lesson, linkDrafts[draftKey] || '');
    if (!result) return;
    if (result.kind === 'error') {
      setErrors(prev => ({ ...prev, [errKey]: result.message }));
      if (result.autoClear) {
        setTimeout(() => setErrors(prev => { const n = { ...prev }; delete n[errKey]; return n; }), 5000);
      }
      return;
    }
    updateLesson(
      chapterIndex,
      lessonIndex,
      result.kind === 'video' ? { videoUrl: result.url } : { links: result.links },
    );
    setLinkDrafts(prev => ({ ...prev, [draftKey]: '' }));
    setErrors(prev => { const n = { ...prev }; delete n[errKey]; return n; });
  };

  const removeLesson = (chapterIndex: number, lessonIndex: number) => {
    setCourse(prev => ({
      ...prev,
      chapters: prev.chapters.map((chapter, ci) =>
        ci === chapterIndex
          ? {
              ...chapter,
              lessons: chapter.lessons
                .filter((_, li) => li !== lessonIndex)
                .map((l, i) => ({ ...l, order: i })),
            }
          : chapter
      ),
    }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, image: 'ניתן להעלות רק קבצי תמונה' }));
        e.target.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setErrors(prev => ({ ...prev, image: 'גודל התמונה חורג מ-20MB' }));
        e.target.value = '';
        return;
      }
      setErrors(prev => { const n = { ...prev }; delete n.image; return n; });
      // Compress image before setting
      const compressedFile = await compressImage(file);
      setCourse(prev => ({
        ...prev,
        image: compressedFile,
        imagePreview: URL.createObjectURL(compressedFile),
      }));
    }
  };

  const validateForm = (): Record<string, string> => {
    const newErrors = validateCourseForm(course, {
      requireImage: true,
      softDelete: false,
      getQuizQuestions: (l) => (l.quiz as QuizQuestionForm[] | null | undefined) || [],
    });
    setErrors(newErrors);
    return newErrors;
  };

  // scrollToFirstError → ../courseFormShared (shared with edit)

  // On a create page "last-saved" is the empty form, so the bar shows once
  // the user has entered anything. Cancel abandons creation → back to the
  // courses list (resetting an empty-ish form in place is pointless here).
  const isDirty =
    course.title.trim() !== '' ||
    course.description.trim() !== '' ||
    course.image !== null ||
    course.chapters.length > 0;

  const allChaptersExpanded =
    course.chapters.length > 0 && course.chapters.every(c => c.expanded);

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setCourse(prev => ({ ...prev, chapters: expandChaptersWithErrors(prev.chapters, validationErrors) }));
      scrollToFirstError(validationErrors);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create the course
      const formData = new FormData();
      formData.append('title', course.title);
      formData.append('description', course.description);
      formData.append('communityId', communityId);
      if (course.image) {
        formData.append('image', course.image);
      }

      console.log('Creating course with:', { title: course.title, description: course.description, communityId });
      
      const courseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, {
        method: 'POST',
        body: formData,
      });

      console.log('Course response status:', courseRes.status);
      
      if (!courseRes.ok) {
        const errorText = await courseRes.text();
        console.error('Course creation error:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || 'Failed to create course');
        } catch {
          throw new Error(`Failed to create course: ${errorText}`);
        }
      }

      const newCourse = await courseRes.json();

      // Create chapters and lessons
      for (const chapter of course.chapters) {
        const chapterRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${newCourse.id}/chapters`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: chapter.title,
            order: chapter.order,
          }),
        });

        if (!chapterRes.ok) {
          throw new Error('Failed to create chapter');
        }

        const newChapter = await chapterRes.json();

        // Create lessons for this chapter
        for (const lesson of chapter.lessons) {
          // Upload image files first
          const uploadedImageUrls: string[] = [...(lesson.images || [])];
          if (lesson.imageFiles && lesson.imageFiles.length > 0) {
            for (const file of lesson.imageFiles) {
              const imageFormData = new FormData();
              imageFormData.append('image', file);
              const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/lessons/upload-image`, {
                method: 'POST',
                body: imageFormData,
              });
              if (uploadRes.ok) {
                const { url } = await uploadRes.json();
                uploadedImageUrls.push(url);
              }
            }
          }

          // Prepare quiz data if lesson is a quiz type
          const quizData = lesson.lessonType === 'quiz' && lesson.quiz && lesson.quiz.length > 0 ? {
            questions: lesson.quiz.map((q, qIndex) => ({
              question: q.question,
              questionType: q.questionType,
              order: qIndex,
              options: q.options.map((opt, optIndex) => ({
                text: opt.text,
                isCorrect: opt.isCorrect,
                order: optIndex,
              })),
            })),
          } : null;

          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/chapters/${newChapter.id}/lessons`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: lesson.title,
              content: lesson.content,
              videoUrl: lesson.videoUrl || null,
              duration: lesson.duration,
              order: lesson.order,
              lessonType: lesson.lessonType,
              images: uploadedImageUrls,
              files: lesson.files,
              links: lesson.links.filter(link => link.trim() !== ''),
              contentOrder: lesson.contentOrder,
              quiz: quizData,
            }),
          });
        }
      }

      // Navigate to the course
      router.push(`/communities/${communityId}/courses/${newCourse.id}`);
    } catch (err) {
      console.error('Failed to save course:', err);
      setError('שגיאה בשמירת הקורס');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 text-right">
      {/* Community Navbar */}
      <CommunityNavbar
        communityId={communityId}
        community={community}
        activePage="courses"
        isOwner={isOwner}
        userEmail={userEmail}
        userId={userId}
        userProfile={userProfile}
      />

      {/* Form Section */}
      <section className="min-h-[calc(100vh-80px)] px-4 py-10 pb-28">
        <div className="w-full max-w-5xl mx-auto">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4 text-xl sm:text-[28px]">פרטי הקורס</h2>

              <div className="space-y-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 text-base sm:text-lg">
                    שם הקורס <span style={{ color: '#B3261E' }}>*</span>
                  </label>
                  <input
                    id="course-title"
                    type="text"
                    value={course.title}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_TITLE_LENGTH) {
                        setCourse({ ...course, title: e.target.value });
                        if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                      }
                    }}
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                      errors.title ? 'border-[#B3261E]' : 'border-gray-300'
                    }`}
                    placeholder="לדוגמה: מבוא לבישול ביתי"
                    maxLength={MAX_TITLE_LENGTH}
                  />
                  <div className="flex justify-between mt-1">
                    {errors.title && <span style={{ color: '#B3261E', fontSize: '14px' }}>{errors.title}</span>}
                    <span className={`text-xs mr-auto ${course.title.length > MAX_TITLE_LENGTH * 0.9 ? 'text-[#B3261E]' : 'text-gray-400'}`}>
                      {course.title.length}/{MAX_TITLE_LENGTH}
                    </span>
                  </div>
                </div>

                {/* Course Image */}
                <div id="course-image-section">
                  <label className="block font-semibold text-gray-700 mb-1 text-base sm:text-lg">
                    תמונת הקורס <span style={{ color: '#B3261E' }}>*</span>
                  </label>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                    id="course-image-upload"
                  />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {course.imagePreview ? (
                      <img
                        src={course.imagePreview}
                        alt="Course preview"
                        className="w-full sm:w-96 aspect-video object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div
                        className="w-full sm:w-96 aspect-video border rounded-lg flex items-center justify-center bg-white"
                        style={{ borderColor: errors.image ? 'var(--color-error)' : '#E5E7EB' }}
                      >
                        <ImageIcon size={32} color={errors.image ? '#B3261E' : '#D1D5DB'} />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="course-image-upload"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 border border-gray-300 cursor-pointer hover:bg-gray-50 transition text-base font-normal w-44"
                        style={{ borderRadius: '8px' }}
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>העלאת תמונה</span>
                      </label>
                      {course.imagePreview && (
                        <button
                          type="button"
                          onClick={() => setCourse({ ...course, image: null, imagePreview: null })}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 border hover:bg-gray-50 transition text-base font-normal w-44"
                          style={{ borderRadius: '8px', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span>מחק תמונה נוכחית</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {errors.image && (
                    <p className="mt-2 text-sm" style={{ color: '#B3261E' }}>{errors.image}</p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1 text-base sm:text-lg">
                    תיאור הקורס <span className="text-gray-400 text-xs font-normal">(אופציונלי)</span>
                  </label>
                  <textarea
                    id="course-description"
                    value={course.description}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                        setCourse({ ...course, description: e.target.value });
                        if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                      }
                    }}
                    rows={4}
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right resize-none ${
                      errors.description ? 'border-[#B3261E]' : 'border-gray-300'
                    }`}
                    placeholder="תאר את הקורס בכמה משפטים"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                  />
                  <div className="flex justify-between mt-1">
                    {errors.description && <span className="text-xs" style={{ color: '#B3261E' }}>{errors.description}</span>}
                    <span className={`text-xs mr-auto ${course.description.length > MAX_DESCRIPTION_LENGTH * 0.9 ? 'text-[#B3261E]' : 'text-gray-400'}`}>
                      {course.description.length}/{MAX_DESCRIPTION_LENGTH}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chapters */}
            <CourseChaptersEditor
              chapters={course.chapters}
              errors={errors}
              setErrors={setErrors}
              linkDrafts={linkDrafts}
              setLinkDrafts={setLinkDrafts}
              allChaptersExpanded={allChaptersExpanded}
              setAllChaptersExpanded={setAllChaptersExpanded}
              addChapter={addChapter}
              updateChapter={updateChapter}
              removeChapter={removeChapter}
              toggleChapter={toggleChapter}
              addLesson={addLesson}
              updateLesson={updateLesson}
              removeLesson={removeLesson}
              toggleLesson={toggleLesson}
              handleAddLink={handleAddLink}
              onSelectContentType={(ci, li) => updateLesson(ci, li, { lessonType: 'content' })}
              getQuizQuestions={(l) => (l.quiz as QuizQuestionForm[] | null | undefined) || []}
              setQuizQuestions={(ci, li, qs) => updateLesson(ci, li, { quiz: qs as unknown as QuizQuestionForm[] })}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Course Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="font-semibold text-gray-800 mb-4 text-base sm:text-lg">סיכום</h2>
              <div className="space-y-2" style={{ fontSize: '16px' }}>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-normal">מספר פרקים:</span>
                  <span className="font-semibold">{course.chapters.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-normal">מספר שיעורים:</span>
                  <span className="font-semibold">
                    {course.chapters.reduce((sum, c) => sum + c.lessons.length, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-normal">משך כולל:</span>
                  <span className="font-semibold flex items-center gap-1">
                    {formatDurationHebrew(course.chapters.reduce((sum, c) => sum + c.lessons.reduce((s, l) => s + l.duration, 0), 0))}
                    <ClockIcon size={16} color="currentColor" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Action Buttons */}
          <div className="mt-8">
            {error && (
              <div
                className="mb-4 px-6 py-3 rounded-lg"
                style={{ backgroundColor: '#FEE2E2', color: 'var(--color-error)' }}
              >
                <span>{error}</span>
              </div>
            )}
          </div>

          <StickySaveBar
            visible={isDirty}
            saving={saving}
            onSave={handleSave}
            onCancel={() => router.push(`/communities/${communityId}/courses`)}
            saveLabel="שמור קורס"
            savingLabel="יוצר..."
          />
        </div>
      </section>
    </main>
  );
}
