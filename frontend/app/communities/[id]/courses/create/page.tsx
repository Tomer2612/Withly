'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FaSave } from 'react-icons/fa';
import { compressImage, compressImages, MAX_IMAGE_SIZE_BYTES } from '../../../../lib/imageCompression';
import { isValidVideoUrl, getVideoProvider, MAX_VIDEO_SIZE_BYTES } from '../../../../lib/videoUtils';
import CommunityNavbar from '../../../../components/CommunityNavbar';
import LinkIcon from '../../../../components/icons/LinkIcon';
import VideoOffIcon from '../../../../components/icons/VideoOffIcon';
import VideoIcon from '../../../../components/icons/VideoIcon';
import FileTextIcon from '../../../../components/icons/FileTextIcon';
import FileQuestionIcon from '../../../../components/icons/FileQuestionIcon';
import LayersIcon from '../../../../components/icons/LayersIcon';
import PlusIcon from '../../../../components/icons/PlusIcon';
import ImageIcon from '../../../../components/icons/ImageIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';
import ChevronUpIcon from '../../../../components/icons/ChevronUpIcon';
import ChevronDownIcon from '../../../../components/icons/ChevronDownIcon';
import ArrowUpIcon from '../../../../components/icons/ArrowUpIcon';
import ArrowDownIcon from '../../../../components/icons/ArrowDownIcon';
import CloseIcon from '../../../../components/icons/CloseIcon';
import CheckIcon from '../../../../components/icons/CheckIcon';
import ClockIcon from '../../../../components/icons/ClockIcon';

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
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profileImage?: string | null } | null>(null);
  const [community, setCommunity] = useState<{ name: string; logo?: string | null } | null>(null);
  const [isOwnerOrManager, setIsOwnerOrManager] = useState(false);

  // Validation constants
  const MAX_TITLE_LENGTH = 100;
  const MAX_DESCRIPTION_LENGTH = 1000;
  const MAX_CHAPTER_TITLE_LENGTH = 80;
  const MAX_LESSON_TITLE_LENGTH = 80;
  const MAX_LESSON_DURATION = 480; // 8 hours max
  const MIN_LESSON_DURATION = 1;

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
    setMounted(true);

    // Read cached profile immediately
    const cached = localStorage.getItem('userProfileCache');
    if (cached) {
      try { setUserProfile(JSON.parse(cached)); } catch {}
    }

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserId(payload.sub);
      setUserEmail(payload.email);
      
      // Fetch user profile
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            const profile = { name: data.name, profileImage: data.profileImage };
            setUserProfile(profile);
            localStorage.setItem('userProfileCache', JSON.stringify(profile));
          }
        })
        .catch(console.error);

      // Fetch community data
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setCommunity({ name: data.name, logo: data.logo });
            // Check if owner or manager
            const currentUserId = payload.sub;
            const isOwner = data.ownerId === currentUserId;
            const membership = data.members?.find((m: any) => m.userId === currentUserId);
            const isManager = membership?.role === 'MANAGER' || membership?.role === 'OWNER';
            setIsOwnerOrManager(isOwner || isManager);
          }
        })
        .catch(console.error);
    } catch (e) {
      console.error('Failed to decode token');
      router.push('/login');
    }
  }, [router, communityId]);

  const addChapter = () => {
    setCourse(prev => ({
      ...prev,
      chapters: [
        ...prev.chapters,
        {
          title: `פרק ${prev.chapters.length + 1}`,
          order: prev.chapters.length,
          lessons: [],
          isNew: true,
          expanded: true,
        },
      ],
    }));
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
    const newErrors: Record<string, string> = {};

    // Course title validation
    if (!course.title.trim()) {
      newErrors.title = 'שם הקורס הוא שדה חובה';
    } else if (course.title.length > MAX_TITLE_LENGTH) {
      newErrors.title = `שם הקורס לא יכול להכיל יותר מ-${MAX_TITLE_LENGTH} תווים`;
    }

    // Description validation
    if (course.description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `התיאור לא יכול להכיל יותר מ-${MAX_DESCRIPTION_LENGTH} תווים`;
    }

    // Image required
    if (!course.image) {
      newErrors.image = 'יש להעלות תמונה לקורס';
    }

    // At least one chapter required
    if (course.chapters.length === 0) {
      newErrors.chapters = 'יש להוסיף לפחות פרק אחד';
    }

    // Chapters and lessons validation
    course.chapters.forEach((chapter, ci) => {
      if (!chapter.title.trim()) {
        newErrors[`chapter_${ci}_title`] = 'שם הפרק הוא שדה חובה';
      } else if (chapter.title.length > MAX_CHAPTER_TITLE_LENGTH) {
        newErrors[`chapter_${ci}_title`] = `שם הפרק לא יכול להכיל יותר מ-${MAX_CHAPTER_TITLE_LENGTH} תווים`;
      }

      // At least one lesson per chapter required
      if (chapter.lessons.length === 0) {
        newErrors[`chapter_${ci}_lessons`] = 'יש להוסיף לפחות שיעור אחד';
      }

      chapter.lessons.forEach((lesson, li) => {
        if (!lesson.title.trim()) {
          newErrors[`lesson_${ci}_${li}_title`] = 'שם השיעור הוא שדה חובה';
        } else if (lesson.title.length > MAX_LESSON_TITLE_LENGTH) {
          newErrors[`lesson_${ci}_${li}_title`] = `שם השיעור לא יכול להכיל יותר מ-${MAX_LESSON_TITLE_LENGTH} תווים`;
        }

        if (!lesson.duration || lesson.duration < MIN_LESSON_DURATION) {
          newErrors[`lesson_${ci}_${li}_duration`] = `משך השיעור חייב להיות לפחות ${MIN_LESSON_DURATION} דקה`;
        } else if (lesson.duration > MAX_LESSON_DURATION) {
          newErrors[`lesson_${ci}_${li}_duration`] = `משך השיעור לא יכול לעלות על ${MAX_LESSON_DURATION} דקות`;
        }

        // Video URL validation (YouTube, Vimeo, Dailymotion, or MP4 link)
        if (lesson.videoUrl && lesson.videoUrl.trim()) {
          if (!isValidVideoUrl(lesson.videoUrl.trim())) {
            newErrors[`lesson_${ci}_${li}_videoUrl`] = 'קישור לא תקין. יש להזין קישור YouTube, Vimeo, Dailymotion או קובץ MP4';
          }
        }

        // Content validation - lesson must have at least one content type (unless it's a quiz)
        if (lesson.lessonType === 'content') {
          const hasVideo = !!lesson.videoUrl;
          const hasText = !!lesson.content?.trim();
          const hasImages = (lesson.images && lesson.images.length > 0) || (lesson.imageFiles && lesson.imageFiles.length > 0);
          const hasLinks = lesson.links && lesson.links.length > 0;
          
          if (!hasVideo && !hasText && !hasImages && !hasLinks) {
            newErrors[`lesson_${ci}_${li}_content`] = 'שיעור לא יכול להיות ריק מתוכן';
          }
        }

        // Quiz validation
        if (lesson.lessonType === 'quiz') {
          if (!lesson.quiz || lesson.quiz.length === 0) {
            newErrors[`lesson_${ci}_${li}_quiz`] = 'בוחן חייב להכיל לפחות שאלה אחת';
          } else {
            lesson.quiz.forEach((question, qi) => {
              if (!question.question.trim()) {
                newErrors[`lesson_${ci}_${li}_quiz_${qi}_question`] = `שאלה ${qi + 1}: יש להזין טקסט לשאלה`;
              }
              
              if (question.questionType === 'radio') {
                // Radio: at least 2 options, exactly 1 correct
                if (question.options.length < 2) {
                  newErrors[`lesson_${ci}_${li}_quiz_${qi}_options`] = `שאלה ${qi + 1}: נדרשות לפחות 2 אפשרויות`;
                }
                const correctCount = question.options.filter(o => o.isCorrect).length;
                if (correctCount !== 1) {
                  newErrors[`lesson_${ci}_${li}_quiz_${qi}_correct`] = `שאלה ${qi + 1}: יש לבחור תשובה נכונה אחת`;
                }
                // Check all options have text
                question.options.forEach((opt, oi) => {
                  if (!opt.text.trim()) {
                    newErrors[`lesson_${ci}_${li}_quiz_${qi}_opt_${oi}`] = `שאלה ${qi + 1}: אפשרות ${oi + 1} חייבת להכיל טקסט`;
                  }
                });
              } else if (question.questionType === 'checkbox') {
                // Checkbox: at least 4 options, at least 2 correct
                if (question.options.length < 4) {
                  newErrors[`lesson_${ci}_${li}_quiz_${qi}_options`] = `שאלה ${qi + 1}: נדרשות לפחות 4 אפשרויות לבחירה מרובה`;
                }
                const correctCount = question.options.filter(o => o.isCorrect).length;
                if (correctCount < 2) {
                  newErrors[`lesson_${ci}_${li}_quiz_${qi}_correct`] = `שאלה ${qi + 1}: יש לבחור לפחות 2 תשובות נכונות`;
                }
                // Check all options have text
                question.options.forEach((opt, oi) => {
                  if (!opt.text.trim()) {
                    newErrors[`lesson_${ci}_${li}_quiz_${qi}_opt_${oi}`] = `שאלה ${qi + 1}: אפשרות ${oi + 1} חייבת להכיל טקסט`;
                  }
                });
              }
            });
          }
        }
      });
    });

    setErrors(newErrors);
    return newErrors;
  };

  const scrollToFirstError = (errorMap: Record<string, string>) => {
    const errorKeys = Object.keys(errorMap);
    if (errorKeys.length === 0) return;
    
    const firstErrorKey = errorKeys[0];
    let elementId = '';
    
    if (firstErrorKey === 'title') {
      elementId = 'course-title';
    } else if (firstErrorKey === 'description') {
      elementId = 'course-description';
    } else if (firstErrorKey === 'image') {
      elementId = 'course-image-section';
    } else if (firstErrorKey === 'chapters') {
      elementId = 'chapters-section';
    } else if (firstErrorKey.startsWith('chapter_')) {
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
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      scrollToFirstError(validationErrors);
      return;
    }

    setSaving(true);
    setError(null);

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

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
        headers: { Authorization: `Bearer ${token}` },
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
            Authorization: `Bearer ${token}`,
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
                headers: { Authorization: `Bearer ${token}` },
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
              Authorization: `Bearer ${token}`,
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
        isOwnerOrManager={isOwnerOrManager}
        userEmail={userEmail}
        userId={userId}
        userProfile={userProfile}
      />

      {/* Form Section */}
      <section className="min-h-[calc(100vh-80px)] px-4 py-10">
        <div className="w-full max-w-5xl mx-auto">

          {error && (
          <div className="mb-4 p-4 rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
            <span>⚠️</span>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Course Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4" style={{ fontSize: '28px' }}>פרטי הקורס</h2>

              <div className="space-y-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '18px' }}>
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
                  <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '18px' }}>
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
                      <div className={`w-full sm:w-96 aspect-video border rounded-lg flex items-center justify-center bg-white ${errors.image ? 'border-red-400' : 'border-gray-200'}`}>
                        <ImageIcon size={32} color={errors.image ? '#F87171' : '#D1D5DB'} />
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
                          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#B3261E] text-[#B3261E] hover:bg-red-50 transition text-base font-normal w-44"
                          style={{ borderRadius: '8px' }}
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
                  <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '18px' }}>
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
                    className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right resize-none scrollbar-styled ${
                      errors.description ? 'border-[#B3261E]' : 'border-gray-300'
                    }`}
                    placeholder="תאר את הקורס בכמה משפטים..."
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
            <div id="chapters-section" className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-gray-800">פרקים ושיעורים</h2>
                <button
                  onClick={addChapter}
                  className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition font-normal" style={{ fontSize: '16px' }}
                >
                  הוסף פרק
                  <PlusIcon size={16} color="white" />
                </button>
              </div>

              {errors.chapters && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FDECEA', color: '#B3261E' }}>
                  {errors.chapters}
                </div>
              )}

              {course.chapters.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <VideoOffIcon size={24} color="black" />
                  </div>
                  <p className="text-black font-normal" style={{ fontSize: '18px' }}>עדיין אין פרקים בקורס</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {course.chapters.map((chapter, chapterIndex) => (
                    <div key={chapterIndex} id={`chapter-${chapterIndex}`} className="rounded-lg overflow-hidden" style={{ border: '1px solid #7A7A83' }}>
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
                            placeholder={`פרק ${chapterIndex + 1}`}
                            maxLength={MAX_CHAPTER_TITLE_LENGTH}
                          />
                          <span className="text-xs block" style={{ color: '#A1A1AA' }}>(לחץ לשנות שם)</span>
                          {errors[`chapter_${chapterIndex}_title`] && (
                            <span className="text-xs" style={{ color: '#B3261E' }}>{errors[`chapter_${chapterIndex}_title`]}</span>
                          )}
                          {errors[`chapter_${chapterIndex}_lessons`] && (
                            <span className="text-xs block mt-1" style={{ color: '#B3261E' }}>{errors[`chapter_${chapterIndex}_lessons`]}</span>
                          )}
                        </div>
                        <span className="font-normal text-white" style={{ fontSize: '16px' }}>
                          {chapter.lessons.length === 1 ? 'שיעור אחד' : `${chapter.lessons.length} שיעורים`}
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

                      {/* Chapter Lessons */}
                      {chapter.expanded && (
                        <div className="p-4" style={{ backgroundColor: '#F4F4F5', borderTop: '1px solid #7A7A83' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                          {chapter.lessons.map((lesson, lessonIndex) => {
                            const hasMultipleContent = [
                              lesson.videoUrl,
                              lesson.content,
                              lesson.images?.length > 0 || lesson.imageFiles?.length > 0,
                              lesson.files?.length > 0,
                              lesson.links?.length > 0,
                            ].filter(Boolean).length > 1;
                            
                            const lessonLabel = lesson.lessonType === 'quiz' 
                              ? 'בוחן' 
                              : 'שיעור';
                            
                            // Determine lesson type icon and label
                            const getLessonIcon = () => {
                              if (lesson.lessonType === 'quiz') return <FileQuestionIcon size={16} color="#6B7280" />;
                              if (hasMultipleContent) return <LayersIcon size={16} color="#6B7280" />;
                              if (lesson.videoUrl) return <VideoIcon size={16} color="#6B7280" />;
                              if (lesson.links?.length > 0) return <LinkIcon size={16} color="#6B7280" />;
                              if (lesson.images?.length > 0 || lesson.imageFiles?.length > 0) return <ImageIcon size={16} color="#6B7280" />;
                              return <FileTextIcon size={16} color="#6B7280" />;
                            };
                            
                            const getLessonTypeLabel = () => {
                              if (lesson.lessonType === 'quiz') return 'בוחן';
                              return 'שיעור';
                            };
                            
                            return (
                            <Fragment key={lessonIndex}>
                            <div id={`lesson-${chapterIndex}-${lessonIndex}`} className="px-4" style={{ paddingTop: lessonIndex === 0 ? '4px' : '12px', paddingBottom: '12px', borderTop: lessonIndex > 0 ? '1px solid #D0D0D4' : 'none' }}>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {getLessonIcon()}
                                  <span className="font-normal text-black" style={{ fontSize: '16px' }}>{getLessonTypeLabel()} {lessonIndex + 1}</span>
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
                                    onClick={() => updateLesson(chapterIndex, lessonIndex, { lessonType: 'content' })}
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
                                      // When switching to quiz, add default question if empty
                                      const updates: Partial<LessonForm> = { lessonType: 'quiz' };
                                      if (!lesson.quiz || lesson.quiz.length === 0) {
                                        updates.quiz = [{
                                          question: '',
                                          questionType: 'radio' as const,
                                          order: 0,
                                          options: [
                                            { text: '', isCorrect: true, order: 0 },
                                            { text: '', isCorrect: false, order: 1 },
                                          ],
                                        }];
                                      }
                                      updateLesson(chapterIndex, lessonIndex, updates);
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
                                    <span className="text-xs" style={{ color: '#B3261E' }}>{errors[`lesson_${chapterIndex}_${lessonIndex}_title`]}</span>
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
                                    <span className="text-xs" style={{ color: '#B3261E' }}>{errors[`lesson_${chapterIndex}_${lessonIndex}_duration`]}</span>
                                  )}
                                </div>
                              </div>

                              {/* Content Type Lesson */}
                              {lesson.lessonType === 'content' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  {/* Content empty error */}
                                  {errors[`lesson_${chapterIndex}_${lessonIndex}_content`] && (
                                    <div className="p-3 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #B3261E' }}>
                                      <span className="text-sm" style={{ color: '#B3261E' }}>{errors[`lesson_${chapterIndex}_${lessonIndex}_content`]}</span>
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
                                              const token = localStorage.getItem('token');
                                              const formData = new FormData();
                                              formData.append('video', file);
                                              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/lessons/upload-video`, {
                                                method: 'POST',
                                                headers: { Authorization: `Bearer ${token}` },
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
                                        <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{errors[`lesson_${chapterIndex}_${lessonIndex}_videoUrl`]}</p>
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
                                        id={`link-input-${chapterIndex}-${lessonIndex}`}
                                        className="flex-1 p-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                                        placeholder="הדבק קישור (YouTube, Vimeo, או כל קישור אחר)"
                                        onChange={(e) => {
                                          const btn = document.getElementById(`link-add-btn-${chapterIndex}-${lessonIndex}`);
                                          const errorSpan = document.getElementById(`link-error-${chapterIndex}-${lessonIndex}`);
                                          if (errorSpan) errorSpan.style.display = 'none';
                                          if (btn) {
                                            const hasValue = e.target.value.trim().length > 0;
                                            btn.style.backgroundColor = hasValue ? '#91DCED' : '#c4ebf5';
                                            btn.style.color = hasValue ? 'black' : '#A1A1AA';
                                            btn.style.cursor = hasValue ? 'pointer' : 'not-allowed';
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const input = e.target as HTMLInputElement;
                                            const errorSpan = document.getElementById(`link-error-${chapterIndex}-${lessonIndex}`);
                                            const value = input.value.trim();
                                            if (value) {
                                              const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
                                              if (!urlPattern.test(value)) {
                                                if (errorSpan) { errorSpan.textContent = 'קישור לא תקין'; errorSpan.style.display = 'block'; }
                                                return;
                                              }
                                              // Route video URLs to videoUrl field
                                              if (isValidVideoUrl(value)) {
                                                if (lesson.videoUrl) {
                                                  if (errorSpan) { errorSpan.textContent = 'ניתן להוסיף סרטון אחד בלבד לשיעור'; errorSpan.style.display = 'block'; setTimeout(() => { errorSpan.style.display = 'none'; }, 5000); }
                                                  return;
                                                }
                                                updateLesson(chapterIndex, lessonIndex, { videoUrl: value });
                                                input.value = '';
                                                if (errorSpan) errorSpan.style.display = 'none';
                                                const btn = document.getElementById(`link-add-btn-${chapterIndex}-${lessonIndex}`);
                                                if (btn) { btn.style.backgroundColor = '#c4ebf5'; btn.style.color = '#A1A1AA'; btn.style.cursor = 'not-allowed'; }
                                                return;
                                              }
                                              // Check duplicate
                                              if ((lesson.links || []).includes(value)) {
                                                if (errorSpan) { errorSpan.textContent = 'קישור זה כבר קיים'; errorSpan.style.display = 'block'; }
                                                return;
                                              }
                                              if ((lesson.links || []).length >= 3) {
                                                if (errorSpan) { errorSpan.textContent = 'ניתן להוסיף עד 3 קישורים'; errorSpan.style.display = 'block'; }
                                                return;
                                              }
                                              updateLesson(chapterIndex, lessonIndex, { links: [...(lesson.links || []), value] });
                                              input.value = '';
                                              if (errorSpan) errorSpan.style.display = 'none';
                                              const btn = document.getElementById(`link-add-btn-${chapterIndex}-${lessonIndex}`);
                                              if (btn) { btn.style.backgroundColor = '#c4ebf5'; btn.style.color = '#A1A1AA'; btn.style.cursor = 'not-allowed'; }
                                            }
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        id={`link-add-btn-${chapterIndex}-${lessonIndex}`}
                                        onClick={() => {
                                          const input = document.getElementById(`link-input-${chapterIndex}-${lessonIndex}`) as HTMLInputElement;
                                          const errorSpan = document.getElementById(`link-error-${chapterIndex}-${lessonIndex}`);
                                          if (input && input.value.trim()) {
                                            const value = input.value.trim();
                                            const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
                                            if (!urlPattern.test(value)) {
                                              if (errorSpan) { errorSpan.textContent = 'קישור לא תקין'; errorSpan.style.display = 'block'; }
                                              return;
                                            }
                                            // Route video URLs to videoUrl field
                                            if (isValidVideoUrl(value)) {
                                              if (lesson.videoUrl) {
                                                if (errorSpan) { errorSpan.textContent = 'ניתן להוסיף סרטון אחד בלבד לשיעור'; errorSpan.style.display = 'block'; setTimeout(() => { errorSpan.style.display = 'none'; }, 5000); }
                                                return;
                                              }
                                              updateLesson(chapterIndex, lessonIndex, { videoUrl: value });
                                              input.value = '';
                                              if (errorSpan) errorSpan.style.display = 'none';
                                              const btn = document.getElementById(`link-add-btn-${chapterIndex}-${lessonIndex}`);
                                              if (btn) { btn.style.backgroundColor = '#c4ebf5'; btn.style.color = '#A1A1AA'; btn.style.cursor = 'not-allowed'; }
                                              return;
                                            }
                                            if ((lesson.links || []).includes(value)) {
                                              if (errorSpan) { errorSpan.textContent = 'קישור זה כבר קיים'; errorSpan.style.display = 'block'; }
                                              return;
                                            }
                                            if ((lesson.links || []).length >= 3) {
                                              if (errorSpan) { errorSpan.textContent = 'ניתן להוסיף עד 3 קישורים'; errorSpan.style.display = 'block'; }
                                              return;
                                            }
                                            updateLesson(chapterIndex, lessonIndex, { links: [...(lesson.links || []), value] });
                                            input.value = '';
                                            if (errorSpan) errorSpan.style.display = 'none';
                                            const btn = document.getElementById(`link-add-btn-${chapterIndex}-${lessonIndex}`);
                                            if (btn) { btn.style.backgroundColor = '#c4ebf5'; btn.style.color = '#A1A1AA'; btn.style.cursor = 'not-allowed'; }
                                          }
                                        }}
                                        className="px-3 py-2 rounded-full text-sm transition"
                                        style={{ backgroundColor: '#c4ebf5', color: '#A1A1AA', fontSize: '14px', cursor: 'not-allowed' }}
                                      >
                                        הוסף
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const input = document.getElementById(`link-input-${chapterIndex}-${lessonIndex}`) as HTMLInputElement;
                                          if (input) {
                                            input.value = '';
                                            const btn = document.getElementById(`link-add-btn-${chapterIndex}-${lessonIndex}`);
                                            if (btn) { btn.style.backgroundColor = '#c4ebf5'; btn.style.color = '#A1A1AA'; btn.style.cursor = 'not-allowed'; }
                                          }
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-600"
                                      >
                                        <CloseIcon size={16} color="currentColor" />
                                      </button>
                                    </div>
                                    <span id={`link-error-${chapterIndex}-${lessonIndex}`} className="text-sm" style={{ color: '#B3261E', display: 'none', marginTop: '4px' }}>קישור לא תקין</span>
                                  </div>
                                  {/* Images */}
                                  <div>
                                    <label className="block text-black font-normal mb-1" style={{ fontSize: '14px' }}>
                                      תמונות <span className="text-gray-400">(אופציונלי)</span>
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {(lesson.imageFiles || []).map((file, imgIndex) => (
                                        <div key={imgIndex} className="relative group">
                                          <img
                                            src={URL.createObjectURL(file)}
                                            alt={file.name}
                                            className="w-full h-24 object-cover rounded-lg"
                                          />
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
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
                                      {(lesson.imageFiles || []).length < 6 && (
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
                                              
                                              const currentCount = (lesson.imageFiles || []).length;
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
                                      <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{errors[`lesson_${chapterIndex}_${lessonIndex}_images`]}</p>
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
                                      className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right scrollbar-styled"
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
                                          const newQuiz = [...(lesson.quiz || []), {
                                            question: '',
                                            questionType: 'radio' as const,
                                            order: (lesson.quiz || []).length,
                                            options: [
                                              { text: '', isCorrect: true, order: 0 },
                                              { text: '', isCorrect: false, order: 1 },
                                            ],
                                          }];
                                          updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
                                        }}
                                        className="bg-black text-white px-3 py-1 rounded hover:bg-gray-800 flex items-center gap-2"
                                        style={{ fontSize: '14px' }}
                                      >
                                        הוסף שאלה
                                        <PlusIcon size={12} color="white" />
                                      </button>
                                    </div>

                                    <div className="space-y-4">
                                      {(!lesson.quiz || lesson.quiz.length === 0) && (
                                        <div className="text-center py-6 text-gray-500" style={{ fontSize: '14px' }}>
                                          אין שאלות בבוחן. לחץ על "הוסף שאלה" כדי להתחיל.
                                        </div>
                                      )}
                                      {(lesson.quiz || []).map((question, qIndex) => (
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
                                                    const newQuiz = [...(lesson.quiz || [])];
                                                    newQuiz[qIndex] = { ...newQuiz[qIndex], question: e.target.value };
                                                    updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
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
                                                  <span className="text-xs" style={{ color: '#B3261E' }}>חובה למלא שאלה</span>
                                                )}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQuiz = (lesson.quiz || []).filter((_, i) => i !== qIndex);
                                                  updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
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
                                                  const newQuiz = [...(lesson.quiz || [])];
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
                                                  updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
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
                                                  const newQuiz = [...(lesson.quiz || [])];
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
                                                  updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
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
                                                        const newQuiz = [...(lesson.quiz || [])];
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
                                                        updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
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
                                                        const newQuiz = [...(lesson.quiz || [])];
                                                        newQuiz[qIndex].options[oIndex] = {
                                                          ...option,
                                                          text: e.target.value,
                                                        };
                                                        updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
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
                                                          const newQuiz = [...(lesson.quiz || [])];
                                                          newQuiz[qIndex].options = question.options.filter((_, i) => i !== oIndex);
                                                          updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
                                                        }}
                                                        className="p-1 hover:bg-gray-100 rounded"
                                                      >
                                                        <CloseIcon size={12} color="#7A7A83" />
                                                      </button>
                                                    )}
                                                  </div>
                                                  {errors[`lesson_${chapterIndex}_${lessonIndex}_quiz_${qIndex}_opt_${oIndex}`] && (
                                                    <span className="text-xs mr-7" style={{ color: '#B3261E' }}>חובה למלא טקסט</span>
                                                  )}
                                                </div>
                                              ))}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQuiz = [...(lesson.quiz || [])];
                                                  newQuiz[qIndex].options = [
                                                    ...question.options,
                                                    { text: '', isCorrect: false, order: question.options.length },
                                                  ];
                                                  updateLesson(chapterIndex, lessonIndex, { quiz: newQuiz });
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
                  ))}

                  {/* Add Chapter button at the end */}
                  <button
                    onClick={addChapter}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition flex items-center justify-center gap-2 font-normal"
                    style={{ fontSize: '16px' }}
                  >
                    הוסף פרק
                    <PlusIcon size={16} color="#4B5563" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Course Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="font-semibold text-gray-800 mb-4" style={{ fontSize: '18px' }}>סיכום</h2>
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
          <div className="flex justify-center gap-4 mt-8">
            <Link
              href={`/communities/${communityId}/courses`}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              ביטול
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving ? 'יוצר...' : 'שמור קורס'}
              <FaSave className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
