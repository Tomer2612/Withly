'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { compressImage, MAX_IMAGE_SIZE_BYTES } from '../../../../../lib/imageCompression';
import CommunityNavbar from '../../../../../components/CommunityNavbar';
import { useUser } from '../../../../../lib/UserContext';
import PlusIcon from '../../../../../components/icons/PlusIcon';
import ImageIcon from '../../../../../components/icons/ImageIcon';
import TrashIcon from '../../../../../components/icons/TrashIcon';
import ClockIcon from '../../../../../components/icons/ClockIcon';
import { getImageUrl } from '@/app/lib/imageUrl';
import StickySaveBar from '../../../../../components/StickySaveBar';
import {
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  addLinkToLesson,
  scrollToFirstError,
  validateCourseForm,
  expandChaptersWithErrors,
} from '../../courseFormShared';
import CourseChaptersEditor from '../../CourseChaptersEditor';

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
  lessonType: 'content' | 'quiz';
  images: string[];
  imageFiles: File[];
  files: { name: string; url: string }[];
  links: string[];
  quiz: {
    questions: QuizQuestionForm[];
  } | null;
  contentOrder: ('video' | 'text' | 'images' | 'links')[];
  isNew?: boolean;
  isDeleted?: boolean;
  expanded?: boolean;
}

interface ChapterForm {
  id?: string;
  title: string;
  order: number;
  lessons: LessonForm[];
  isNew?: boolean;
  isDeleted?: boolean;
  expanded: boolean;
}

interface CourseForm {
  id: string;
  title: string;
  description: string;
  image: string | null;
  newImage: File | null;
  imagePreview: string | null;
  chapters: ChapterForm[];
  isPublished: boolean;
}

export default function EditCoursePage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;
  const courseId = params.courseId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [course, setCourse] = useState<CourseForm | null>(null);
  // Snapshot of the course as loaded; drives dirty-detection + reset.
  const initialCourseRef = useRef<CourseForm | null>(null);
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
  const [isOwnerOrManager, setIsOwnerOrManager] = useState(false);

  // Validation constants → ../../courseFormShared

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

    (async () => {
      try {
        const communityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (!communityRes.ok) return;
        const data = await communityRes.json();
        setCommunity({ name: data.name, logo: data.logo });
        const isOwner = data.ownerId === user.userId;
        const membership = data.members?.find((m: any) => m.userId === user.userId);
        const isManager = membership?.role === 'MANAGER' || membership?.role === 'OWNER';
        setIsOwnerOrManager(isOwner || isManager);
      } catch (err) {
        console.error('Failed to load community:', err);
      }
    })();

    fetchCourse();
  }, [courseId, router, communityId, user]);

  const fetchCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`, );
      if (res.ok) {
        const data = await res.json();
        const loaded: CourseForm = {
          id: data.id,
          title: data.title,
          description: data.description || '',
          image: data.image,
          newImage: null,
          imagePreview: data.image ? getImageUrl(data.image) : null,
          isPublished: data.isPublished,
          chapters: data.chapters.map((c: any) => ({
            id: c.id,
            title: c.title,
            order: c.order,
            expanded: false,
            lessons: c.lessons.map((l: any) => ({
              id: l.id,
              title: l.title,
              content: l.content || '',
              videoUrl: l.videoUrl || '',
              duration: l.duration,
              order: l.order,
              lessonType: l.lessonType || 'content',
              images: l.images || [],
              imageFiles: [],
              files: l.files || [],
              links: l.links || [],
              quiz: l.quiz ? {
                questions: l.quiz.questions.map((q: any, qIndex: number) => ({
                  id: q.id,
                  question: q.question,
                  questionType: q.questionType,
                  order: q.order ?? qIndex,
                  options: q.options.map((opt: any, optIndex: number) => ({
                    id: opt.id,
                    text: opt.text,
                    isCorrect: opt.isCorrect,
                    order: opt.order ?? optIndex,
                  })),
                })),
              } : null,
            })),
          })),
        };
        setCourse(loaded);
        initialCourseRef.current = JSON.parse(JSON.stringify(loaded));
      } else {
        router.push(`/communities/${communityId}/courses`);
      }
    } catch (err) {
      console.error('Failed to fetch course:', err);
    }
  };

  const addChapter = () => {
    if (!course) return;
    setCourse(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        chapters: [
          ...prev.chapters.map(c => ({ ...c, expanded: false })),
          {
            title: `פרק ${prev.chapters.filter(c => !c.isDeleted).length + 1}`,
            order: prev.chapters.length,
            lessons: [
              {
                title: 'שיעור 1',
                content: '',
                videoUrl: '',
                duration: 10,
                order: 0,
                lessonType: 'content' as const,
                images: [],
                imageFiles: [],
                files: [],
                links: [],
                quiz: null,
                contentOrder: ['video', 'links', 'images', 'text'],
                isNew: true,
                expanded: true,
              },
            ],
            isNew: true,
            expanded: true,
          },
        ],
      };
    });
    // The "at least one chapter" error is now resolved — clear it.
    setErrors(prev => { const n = { ...prev }; delete n.chapters; return n; });
  };

  const setAllChaptersExpanded = (expanded: boolean) => {
    if (!course) return;
    setCourse(prev => (prev ? { ...prev, chapters: prev.chapters.map(c => ({ ...c, expanded })) } : prev));
  };

  const updateChapter = (index: number, updates: Partial<ChapterForm>) => {
    if (!course) return;
    setCourse(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        chapters: prev.chapters.map((c, i) => (i === index ? { ...c, ...updates } : c)),
      };
    });
  };

  const removeChapter = (index: number) => {
    if (!course) return;
    const chapter = course.chapters[index];
    
    // Helper to renumber chapters with default "פרק X" titles
    const renumberChapters = (chapters: typeof course.chapters) => {
      let visibleIndex = 0;
      return chapters.map((c) => {
        if (c.isDeleted) return c;
        visibleIndex++;
        // Only update title if it follows the "פרק X" pattern
        const match = c.title.match(/^פרק\s*\d+$/);
        if (match) {
          return { ...c, title: `פרק ${visibleIndex}` };
        }
        return c;
      });
    };
    
    if (chapter.isNew) {
      setCourse(prev => {
        if (!prev) return prev;
        const filtered = prev.chapters.filter((_, i) => i !== index);
        return {
          ...prev,
          chapters: renumberChapters(filtered),
        };
      });
    } else {
      setCourse(prev => {
        if (!prev) return prev;
        const updated = prev.chapters.map((c, i) => 
          i === index ? { ...c, isDeleted: true } : c
        );
        return {
          ...prev,
          chapters: renumberChapters(updated),
        };
      });
    }
  };

  const toggleChapter = (index: number) => {
    if (!course) return;
    updateChapter(index, { expanded: !course.chapters[index].expanded });
  };

  const toggleLesson = (chapterIndex: number, lessonIndex: number) => {
    if (!course) return;
    updateLesson(chapterIndex, lessonIndex, { expanded: !course.chapters[chapterIndex].lessons[lessonIndex].expanded });
  };

  const addLesson = (chapterIndex: number) => {
    if (!course) return;
    setCourse(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        chapters: prev.chapters.map((chapter, i) =>
          i === chapterIndex
            ? {
                ...chapter,
                lessons: [
                  ...chapter.lessons,
                  {
                    title: `שיעור ${chapter.lessons.filter(l => !l.isDeleted).length + 1}`,
                    content: '',
                    videoUrl: '',
                    duration: 10,
                    order: chapter.lessons.length,
                    lessonType: 'content' as const,
                    images: [],
                    imageFiles: [],
                    files: [],
                    links: [],
                    quiz: null,
                    contentOrder: ['video', 'links', 'images', 'text'],
                    isNew: true,
                    expanded: true,
                  },
                ],
              }
            : chapter
        ),
      };
    });
    // This chapter now has a lesson — clear its "at least one lesson" error.
    setErrors(prev => {
      const n = { ...prev };
      delete n[`chapter_${chapterIndex}_lessons`];
      return n;
    });
  };

  const updateLesson = (chapterIndex: number, lessonIndex: number, updates: Partial<LessonForm>) => {
    if (!course) return;
    setCourse(prev => {
      if (!prev) return prev;
      return {
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
      };
    });
  };

  // Add a link (or route a video URL to videoUrl) for a lesson. Pure React
  // state — no getElementById/DOM mutation. Error goes to the `errors` map
  // under `link_<ci>_<li>`; the input draft lives in `linkDrafts`.
  const handleAddLink = (chapterIndex: number, lessonIndex: number) => {
    if (!course) return;
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
    if (!course) return;
    const lesson = course.chapters[chapterIndex].lessons[lessonIndex];
    
    // Helper to renumber lessons with default "שיעור X" titles
    const renumberLessons = (lessons: typeof course.chapters[0]['lessons']) => {
      let visibleIndex = 0;
      return lessons.map((l) => {
        if (l.isDeleted) return l;
        visibleIndex++;
        // Only update title if it follows the "שיעור X" pattern
        const match = l.title.match(/^שיעור\s*\d+$/);
        if (match) {
          return { ...l, title: `שיעור ${visibleIndex}` };
        }
        return l;
      });
    };
    
    if (lesson.isNew) {
      setCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: prev.chapters.map((chapter, ci) =>
            ci === chapterIndex
              ? {
                  ...chapter,
                  lessons: renumberLessons(chapter.lessons.filter((_, li) => li !== lessonIndex)),
                }
              : chapter
          ),
        };
      });
    } else {
      setCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: prev.chapters.map((chapter, ci) =>
            ci === chapterIndex
              ? {
                  ...chapter,
                  lessons: renumberLessons(
                    chapter.lessons.map((l, li) =>
                      li === lessonIndex ? { ...l, isDeleted: true } : l
                    )
                  ),
                }
              : chapter
          ),
        };
      });
    }
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
      setCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          newImage: compressedFile,
          imagePreview: URL.createObjectURL(compressedFile),
        };
      });
    }
  };

  const validateForm = (): Record<string, string> => {
    if (!course) return {};
    const newErrors = validateCourseForm(course, {
      requireImage: false,
      softDelete: true,
      getQuizQuestions: (l) =>
        (l.quiz as { questions: QuizQuestionForm[] } | null | undefined)?.questions || [],
    });
    setErrors(newErrors);
    return newErrors;
  };

  // scrollToFirstError → ../../courseFormShared (shared with create; now
  // also includes the `image` branch this page's copy was missing).

  // Serialise for dirty-detection. File instances can't be JSON-compared, so
  // collapse each to a stable token (added/removed files still differ).
  // `expanded`/`isNew` are pure UI/transient flags — excluded so toggling a
  // chapter open/closed (or expand/collapse-all) never marks the form dirty.
  const serializeCourse = (c: CourseForm | null) =>
    JSON.stringify(c, (k, v) => {
      if (k === 'expanded' || k === 'isNew') return undefined;
      return v instanceof File ? `__file__:${v.name}:${v.size}:${v.lastModified}` : v;
    });

  const isDirty =
    !!course &&
    !!initialCourseRef.current &&
    serializeCourse(course) !== serializeCourse(initialCourseRef.current);

  const allChaptersExpanded =
    !!course &&
    course.chapters.filter(c => !c.isDeleted).length > 0 &&
    course.chapters.filter(c => !c.isDeleted).every(c => c.expanded);

  // Revert to the course as last loaded and stay on the page. The snapshot
  // has no File objects, so a JSON clone is a faithful restore. Carry the
  // user's current expand/collapse state over by id (existing items) so
  // ביטול doesn't visually collapse the editor — it only reverts data.
  const handleResetCourse = () => {
    if (!initialCourseRef.current) return;
    const snapshot: CourseForm = JSON.parse(JSON.stringify(initialCourseRef.current));
    const currentExpansion = new Map<string, { expanded: boolean; lessons: Map<string, boolean> }>();
    course?.chapters.forEach(c => {
      if (!c.id) return;
      const lessonMap = new Map<string, boolean>();
      c.lessons.forEach(l => { if (l.id) lessonMap.set(l.id, l.expanded !== false); });
      currentExpansion.set(c.id, { expanded: c.expanded, lessons: lessonMap });
    });
    snapshot.chapters = snapshot.chapters.map(c => {
      const saved = c.id ? currentExpansion.get(c.id) : undefined;
      if (!saved) return c;
      return {
        ...c,
        expanded: saved.expanded,
        lessons: c.lessons.map(l => {
          const lExpanded = l.id ? saved.lessons.get(l.id) : undefined;
          return lExpanded !== undefined ? { ...l, expanded: lExpanded } : l;
        }),
      };
    });
    setCourse(snapshot);
    setError(null);
    setErrors({});
  };

  const handleSave = async () => {
    if (!course) return;
    
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setCourse(prev => prev ? { ...prev, chapters: expandChaptersWithErrors(prev.chapters, validationErrors) } : prev);
      scrollToFirstError(validationErrors);
      return;
    }

    setSaving(true);
    setError(null);

    // Helper function to upload lesson images
    const uploadLessonImages = async (lesson: LessonForm): Promise<string[]> => {
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
      return uploadedImageUrls;
    };

    try {
      // Update course details
      const formData = new FormData();
      formData.append('title', course.title);
      formData.append('description', course.description);
      formData.append('isPublished', 'true');
      if (course.newImage) {
        formData.append('image', course.newImage);
      }

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`, {
        method: 'PATCH',
        body: formData,
      });

      // Process chapters
      for (const chapter of course.chapters) {
        if (chapter.isDeleted && chapter.id) {
          // Delete chapter
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/chapters/${chapter.id}`, {
            method: 'DELETE',
          });
        } else if (chapter.isNew) {
          // Create new chapter
          const chapterRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/chapters`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: chapter.title,
              order: chapter.order,
            }),
          });

          const newChapter = await chapterRes.json();

          // Create lessons for new chapter
          for (const lesson of chapter.lessons) {
            if (!lesson.isDeleted) {
              // Upload images first
              const uploadedImages = await uploadLessonImages(lesson);

              // Prepare quiz data if lesson is a quiz type
              const quizData = lesson.lessonType === 'quiz' && lesson.quiz ? {
                questions: lesson.quiz.questions.map((q, qIndex) => ({
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
                  images: uploadedImages,
                  files: lesson.files,
                  links: lesson.links.filter(link => link.trim() !== ''),
                  contentOrder: lesson.contentOrder,
                  quiz: quizData,
                }),
              });
            }
          }
        } else if (chapter.id) {
          // Update existing chapter
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/chapters/${chapter.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: chapter.title,
              order: chapter.order,
            }),
          });

          // Process lessons
          for (const lesson of chapter.lessons) {
            if (lesson.isDeleted && lesson.id) {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/lessons/${lesson.id}`, {
                method: 'DELETE',
              });
            } else if (lesson.isNew) {
              // Upload images first
              const uploadedImages = await uploadLessonImages(lesson);

              // Prepare quiz data if lesson is a quiz type
              const quizData = lesson.lessonType === 'quiz' && lesson.quiz ? {
                questions: lesson.quiz.questions.map((q, qIndex) => ({
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

              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/chapters/${chapter.id}/lessons`, {
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
                  images: uploadedImages,
                  files: lesson.files,
                  links: lesson.links.filter(link => link.trim() !== ''),
                  contentOrder: lesson.contentOrder,
                  quiz: quizData,
                }),
              });
            } else if (lesson.id) {
              // Upload images first
              const uploadedImages = await uploadLessonImages(lesson);

              // Prepare quiz data if lesson is a quiz type
              const quizData = lesson.lessonType === 'quiz' && lesson.quiz ? {
                questions: lesson.quiz.questions.map((q, qIndex) => ({
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

              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/lessons/${lesson.id}`, {
                method: 'PATCH',
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
                  images: uploadedImages,
                  files: lesson.files,
                  links: lesson.links.filter(link => link.trim() !== ''),
                  contentOrder: lesson.contentOrder,
                  quiz: quizData,
                }),
              });
            }
          }
        }
      }

      router.push(`/communities/${communityId}/courses/${courseId}`);
    } catch (err) {
      console.error('Failed to save course:', err);
      setError('שגיאה בשמירת הקורס');
    } finally {
      setSaving(false);
    }
  };



  if (!course) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">הקורס לא נמצא</p>
      </div>
    );
  }

  const activeChapters = course.chapters.filter(c => !c.isDeleted);

  return (
    <main className="min-h-screen bg-gray-100 text-right">
      {/* Community Navbar */}
      <CommunityNavbar
        communityId={communityId}
        community={community}
        activePage="courses"
        isOwnerOrManager={isOwnerOrManager}
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
                    maxLength={MAX_TITLE_LENGTH}
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                      errors.title ? 'border-[#B3261E]' : 'border-gray-300'
                    }`}
                    placeholder="לדוגמה: מבוא לבישול ביתי"
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
                        className="w-full sm:w-96 aspect-video object-cover rounded-lg"
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
                          onClick={() => setCourse({ ...course, newImage: null, imagePreview: null })}
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
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    rows={4}
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right resize-none scrollbar-styled ${
                      errors.description ? 'border-[#B3261E]' : 'border-gray-300'
                    }`}
                    placeholder="תאר את הקורס בכמה משפטים"
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
              getQuizQuestions={(l) => (l.quiz as { questions: QuizQuestionForm[] } | null | undefined)?.questions || []}
              setQuizQuestions={(ci, li, qs) => updateLesson(ci, li, { quiz: { questions: qs as unknown as QuizQuestionForm[] } })}
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
                  <span className="font-semibold">{activeChapters.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-normal">מספר שיעורים:</span>
                  <span className="font-semibold">
                    {activeChapters.reduce((sum, c) => sum + c.lessons.filter(l => !l.isDeleted).length, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-normal">משך כולל:</span>
                  <span className="font-semibold flex items-center gap-1">
                    {formatDurationHebrew(activeChapters.reduce((sum, c) => sum + c.lessons.filter(l => !l.isDeleted).reduce((s, l) => s + l.duration, 0), 0))}
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
            onCancel={handleResetCourse}
          />
        </div>
      </section>
    </main>
  );
}
