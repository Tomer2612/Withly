'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ClockIcon from '../../../../components/icons/ClockIcon';
import UsersIcon from '../../../../components/icons/UsersIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';
import ChevronUpIcon from '../../../../components/icons/ChevronUpIcon';
import ChevronDownIcon from '../../../../components/icons/ChevronDownIcon';
import EditIcon from '../../../../components/icons/EditIcon';
import CheckIcon from '../../../../components/icons/CheckIcon';
import CloseIcon from '../../../../components/icons/CloseIcon';
import LinkIcon from '../../../../components/icons/LinkIcon';
import VideoIcon from '../../../../components/icons/VideoIcon';
import FileTextIcon from '../../../../components/icons/FileTextIcon';
import FileQuestionIcon from '../../../../components/icons/FileQuestionIcon';
import LayersIcon from '../../../../components/icons/LayersIcon';
import ImageIcon from '../../../../components/icons/ImageIcon';
import PlayIcon from '../../../../components/icons/PlayIcon';
import VideoPlayer from '../../../../components/VideoPlayer';
import { isValidVideoUrl } from '@/app/lib/videoUtils';
import { getImageUrl } from '@/app/lib/imageUrl';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuizQuestion {
  id: string;
  question: string;
  questionType: 'radio' | 'checkbox';
  order: number;
  options: QuizOption[];
}

interface LessonQuiz {
  id: string;
  questions: QuizQuestion[];
}

interface Lesson {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  duration: number;
  order: number;
  lessonType: 'content' | 'quiz';
  images: string[];
  files: { name: string; url: string }[];
  links: string[];
  contentOrder: string[];
  quiz: LessonQuiz | null;
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  image: string | null;
  totalLessons: number;
  totalDuration: number;
  isPublished: boolean;
  authorId: string;
  author: { id: string; name: string; profileImage: string | null };
  community: { id: string; name: string; ownerId: string; logo?: string | null };
  chapters: Chapter[];
  enrollment: { progress: number; completedAt: string | null } | null;
  lessonProgress: Record<string, boolean>;
  _count: { enrollments: number };
}

function CourseViewerContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const communityId = params.id as string;
  const courseId = params.courseId as string;
  const lessonIdFromUrl = searchParams.get('lesson');

  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [completingLesson, setCompletingLesson] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profileImage?: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUnenrollModal, setShowUnenrollModal] = useState(false);
  const [lessonStartTime, setLessonStartTime] = useState<number | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [contentNeedsScroll, setContentNeedsScroll] = useState(false);
  // Track clicked links and viewed images for auto-complete
  const [clickedLinks, setClickedLinks] = useState<Set<number>>(new Set());
  const [viewedImages, setViewedImages] = useState<Set<number>>(new Set());
  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // Read cached profile immediately
    const cached = localStorage.getItem('userProfileCache');
    if (cached) {
      try { setUserProfile(JSON.parse(cached)); } catch {}
    }

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.sub);
        setUserEmail(payload.email);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              const profile = { name: data.name, profileImage: data.profileImage };
              setUserProfile(profile);
              localStorage.setItem('userProfileCache', JSON.stringify(profile));
            }
          })
          .catch(console.error);
      } catch (e) { console.error('Failed to decode token'); }
    }
    fetchCourse();
  }, [courseId]);

  useEffect(() => {
    if (course && course.chapters.length > 0) {
      // Check if user has access (enrolled or owner/author)
      const isOwnerOrAuthor = userId && (course.authorId === userId || course.community.ownerId === userId);
      if (course.enrollment || isOwnerOrAuthor) {
        setExpandedChapters(new Set(course.chapters.map(c => c.id)));
        if (lessonIdFromUrl) {
          const lesson = findLessonById(lessonIdFromUrl);
          if (lesson) { setCurrentLesson(lesson); return; }
        }
        if (course.chapters[0]?.lessons.length > 0) setCurrentLesson(course.chapters[0].lessons[0]);
      }
      
      // Auto-enroll owner/author if not already enrolled
      if (isOwnerOrAuthor && !course.enrollment) {
        const token = localStorage.getItem('token');
        if (token) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/enroll`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` },
          }).then(res => {
            if (res.ok) fetchCourse();
          }).catch(console.error);
        }
      }
    }
  }, [course, lessonIdFromUrl, userId]);



  // Check if all conditions are met to auto-complete
  const checkAutoComplete = useCallback(() => {
    if (!currentLesson || !course?.enrollment) return;
    if (course.lessonProgress[currentLesson.id]) return;
    if (!lessonStartTime || Date.now() - lessonStartTime < 5000) return; // 5 seconds minimum
    
    const hasVideo = !!currentLesson.videoUrl;
    const hasText = !!currentLesson.content;
    const lessonLinks = currentLesson.links || [];
    const hasLinksContent = lessonLinks.length > 0;
    const lessonImages = currentLesson.images || [];
    const hasImagesContent = lessonImages.length > 0;
    
    // Check individual conditions
    const videoComplete = !hasVideo || hasVideoEnded;
    const textComplete = !hasText || hasScrolledToBottom || !contentNeedsScroll;
    const linksComplete = !hasLinksContent || clickedLinks.size >= lessonLinks.length;
    const imagesComplete = !hasImagesContent || viewedImages.size >= lessonImages.length;
    
    // All conditions must be met
    if (videoComplete && textComplete && linksComplete && imagesComplete) {
      // At least one content type must exist
      if (hasVideo || hasText || hasLinksContent || hasImagesContent) {
        handleCompleteLesson(currentLesson.id);
      }
    }
  }, [currentLesson, course, lessonStartTime, hasVideoEnded, hasScrolledToBottom, contentNeedsScroll, clickedLinks, viewedImages]);

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    setHasVideoEnded(true);
  }, []);



  // Reset state when lesson changes
  useEffect(() => {
    if (!currentLesson || !course?.enrollment) return;
    if (course.lessonProgress[currentLesson.id]) return; // Already completed
    
    setLessonStartTime(Date.now());
    setHasScrolledToBottom(false);
    setHasVideoEnded(false);
    setContentNeedsScroll(false);
    // Reset quiz state
    setQuizAnswers({});
    setQuizSubmitted({});
    // Reset click/view tracking
    setClickedLinks(new Set());
    setViewedImages(new Set());
    
    // Check if content needs scroll after a short delay
    setTimeout(() => {
      if (contentRef.current) {
        const needsScroll = contentRef.current.scrollHeight > contentRef.current.clientHeight + 50;
        setContentNeedsScroll(needsScroll);
        // If no scroll needed, mark as scrolled
        if (!needsScroll) {
          setHasScrolledToBottom(true);
        }
      }
    }, 500);
  }, [currentLesson?.id]);

  // Handle content scroll
  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!currentLesson || !course?.enrollment) return;
    if (course.lessonProgress[currentLesson.id]) return;
    
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [currentLesson, course, hasScrolledToBottom]);

  // Lightbox functions
  const openLightbox = (images: string[], startIndex: number = 0) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setShowLightbox(true);
  };

  const closeLightbox = () => {
    setShowLightbox(false);
    setLightboxImages([]);
    setLightboxIndex(0);
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showLightbox) return;
      
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowRight') {
        prevImage(); // RTL - right goes to previous
      } else if (e.key === 'ArrowLeft') {
        nextImage(); // RTL - left goes to next
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox, lightboxImages.length]);

  // Check periodically if auto-complete conditions are met
  useEffect(() => {
    if (!currentLesson || !course?.enrollment) return;
    if (course.lessonProgress[currentLesson.id]) return;

    const checkInterval = setInterval(() => {
      checkAutoComplete();
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [currentLesson, course, checkAutoComplete]);

  // Also check immediately when conditions change
  useEffect(() => {
    checkAutoComplete();
  }, [hasVideoEnded, hasScrolledToBottom, clickedLinks, viewedImages, checkAutoComplete]);

  const findLessonById = (lessonId: string): Lesson | null => {
    if (!course) return null;
    for (const chapter of course.chapters) {
      const lesson = chapter.lessons.find(l => l.id === lessonId);
      if (lesson) return lesson;
    }
    return null;
  };

  const fetchCourse = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setCourse(await res.json());
      } else if (res.status === 404) {
        // Course not found - redirect to courses list
        router.push(`/communities/${communityId}/courses`);
      } else {
        // Other error (500, etc.) - log but don't redirect, show error state
        console.error('Failed to fetch course:', res.status, res.statusText);
      }
    } catch (err) { 
      // Network error - don't redirect, retry will happen on next navigation
      console.error('Failed to fetch course:', err); 
    }
    finally { setLoading(false); }
  };

  const handleEnroll = async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    setEnrolling(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/enroll`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchCourse();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Enrollment failed:', res.status, errorData);
        alert('שגיאה בהרשמה לקורס: ' + (errorData.message || res.statusText));
      }
    } catch (err) { 
      console.error('Failed to enroll:', err);
      alert('שגיאה בהרשמה לקורס');
    }
    finally { setEnrolling(false); }
  };

  const handleUnenroll = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setUnenrolling(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}/enroll`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShowUnenrollModal(false);
        router.push(`/communities/${communityId}/courses`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Unenroll failed:', res.status, errorData);
        alert('שגיאה בביטול הרשמה: ' + (errorData.message || res.statusText));
      }
    } catch (err) { 
      console.error('Failed to unenroll:', err);
      alert('שגיאה בביטול הרשמה');
    }
    finally { setUnenrolling(false); }
  };

  const handleCompleteLesson = async (lessonId?: string) => {
    const targetLessonId = lessonId || currentLesson?.id;
    if (!targetLessonId || !course?.enrollment) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const isCompleted = course.lessonProgress[targetLessonId];
    
    // Optimistic update - immediately update UI
    setCourse(prev => {
      if (!prev) return prev;
      const newProgress = { ...prev.lessonProgress, [targetLessonId]: !isCompleted };
      const totalLessons = prev.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
      const completedLessons = Object.values(newProgress).filter(Boolean).length;
      const newProgressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      return {
        ...prev,
        lessonProgress: newProgress,
        enrollment: prev.enrollment ? { ...prev.enrollment, progress: newProgressPercent } : null,
      };
    });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/lessons/${targetLessonId}/complete`, {
        method: isCompleted ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Revert on error
        setCourse(prev => {
          if (!prev) return prev;
          return { ...prev, lessonProgress: { ...prev.lessonProgress, [targetLessonId]: isCompleted } };
        });
      }
    } catch (err) {
      console.error('Failed to toggle lesson completion:', err);
      // Revert on error
      setCourse(prev => {
        if (!prev) return prev;
        return { ...prev, lessonProgress: { ...prev.lessonProgress, [targetLessonId]: isCompleted } };
      });
    }
  };

  const handleDeleteCourse = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) router.push(`/communities/${communityId}/courses`);
    } catch (err) { console.error('Failed to delete course:', err); }
    finally { setDeleting(false); setShowDeleteModal(false); }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) newSet.delete(chapterId);
      else newSet.add(chapterId);
      return newSet;
    });
  };

  const selectLesson = (lesson: Lesson) => {
    // Allow owners/authors to view lessons without enrollment
    const canAccess = course?.enrollment || (course && userId && (course.authorId === userId || course.community.ownerId === userId));
    if (!canAccess) return;
    setCurrentLesson(lesson);
    router.push(`/communities/${communityId}/courses/${courseId}?lesson=${lesson.id}`, { scroll: false });
  };

  const getChapterCompletion = (chapter: Chapter) => {
    const total = chapter.lessons.length;
    const completed = chapter.lessons.filter(l => course?.lessonProgress[l.id]).length;
    return { completed, total };
  };

  const calculateProgress = (): number => {
    if (!course) return 0;
    const totalLessons = course.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
    if (totalLessons === 0) return 0;
    const completedLessons = Object.values(course.lessonProgress).filter(Boolean).length;
    return Math.round((completedLessons / totalLessons) * 100);
  };

  const isOwnerOrAuthor = course && userId && (course.authorId === userId || course.community.ownerId === userId);
  const isCourseAuthor = course && userId && course.authorId === userId;
  const isVideoLesson = (lesson: Lesson) => !!lesson.videoUrl;
  const isQuizLesson = (lesson: Lesson) => lesson.lessonType === 'quiz';
  const hasImages = (lesson: Lesson) => lesson.images && lesson.images.length > 0;
  const hasLinks = (lesson: Lesson) => lesson.links && lesson.links.length > 0;
  
  const getLessonIcon = (lesson: Lesson, isCompleted: boolean) => {
    const iconClass = `w-3.5 h-3.5 ${isCompleted ? 'text-gray-700' : 'text-gray-500'}`;
    if (lesson.lessonType === 'quiz') return <FileQuestionIcon size={14} className={iconClass} />;
    // Check if combined (multiple content types)
    const contentTypes = [
      !!lesson.videoUrl,
      !!lesson.content,
      hasLinks(lesson),
      hasImages(lesson)
    ].filter(Boolean).length;
    if (contentTypes > 1) return <LayersIcon size={14} className={iconClass} />;
    // Single content type
    if (lesson.videoUrl) return <VideoIcon size={14} className={iconClass} />;
    if (hasLinks(lesson)) return <LinkIcon size={14} className={iconClass} />;
    if (hasImages(lesson)) return <ImageIcon size={14} className={iconClass} />;
    return <FileTextIcon size={14} className={iconClass} />;
  };

  if (!course) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-500">הקורס לא נמצא</p></div>;

  const progress = calculateProgress();

  // If not enrolled, show enrollment page
  if (!course.enrollment && !isOwnerOrAuthor) {
    return (
      <main className="min-h-screen bg-gray-100" dir="rtl">
        <div className="max-w-4xl mx-auto px-8 py-16">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            {course.image && <img src={getImageUrl(course.image)} alt={course.title} className="w-full h-64 object-cover rounded-xl mb-8" />}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{course.title}</h1>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">{course.description}</p>
            <div className="flex items-center justify-center gap-6 mb-8 text-gray-500">
              <span className="flex items-center gap-2"><VideoIcon size={20} />{course.totalLessons} שיעורים</span>
              <span className="flex items-center gap-2"><ClockIcon size={20} />{course.totalDuration} דקות</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={handleEnroll} disabled={enrolling} className="px-8 py-3 bg-black text-white font-medium rounded-full hover:bg-gray-800 transition disabled:opacity-50 text-lg">{enrolling ? 'נרשם...' : 'הרשמה לקורס (חינם)'}</button>
              <Link href={`/communities/${communityId}/courses`} className="px-6 py-3 text-gray-600 hover:text-gray-900 transition">חזרה לקורסים</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Enrolled or Owner - show course viewer
  return (
    <div className="flex flex-col bg-white overflow-hidden" style={{ height: 'calc(100vh - 72px)' }} dir="rtl">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* Sticky sidebar header */}
          <div className="flex-shrink-0 p-4">
            {/* Edit button for course author */}
            {isCourseAuthor && (
              <Link 
                href={`/communities/${communityId}/courses/${courseId}/edit`} 
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition mb-4"
                style={{ fontSize: '16px' }}
              >
                <EditIcon className="w-4 h-4" />
                עריכת קורס
              </Link>
            )}
            {/* Course title */}
            <h2 className="font-semibold text-[#18181B] leading-tight" style={{ fontSize: '21px' }}>{course.title}</h2>
            {/* Course description */}
            {course.description && (
              <p className="text-[#52525B] mt-2 break-words" style={{ fontSize: '14px' }}>{course.description}</p>
            )}
            {/* Progress bar - only for non-authors */}
            {course.enrollment && !isCourseAuthor && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1"><span>התקדמות</span><span className="font-medium">{progress}%</span></div>
                <div className="h-2 bg-[#D4F5C4] rounded-full overflow-hidden"><div className="h-full bg-[#A7EA7B] rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </div>
          {/* Divider */}
          <div className="h-px bg-[#D4D4D8]" />
          <div className="flex-1 overflow-y-auto" dir="ltr">
            <div dir="rtl">
            {course.chapters.map((chapter, chapterIndex) => {
              const { completed, total } = getChapterCompletion(chapter);
              const isExpanded = expandedChapters.has(chapter.id);
              return (
                <div key={chapter.id}>
                  {/* Divider between chapters */}
                  {chapterIndex > 0 && <div className="h-px bg-[#D4D4D8]" />}
                  <button onClick={() => toggleChapter(chapter.id)} className="w-full flex items-center justify-between hover:bg-gray-50 transition text-right" style={{ padding: '16px 32px' }}>
                    <div className="flex-1">
                      <span className="font-semibold text-[#18181B]" style={{ fontSize: '18px' }}>{chapter.title}</span>
                    </div>
                    {isExpanded ? <ChevronUpIcon size={16} color="#A1A1AA" /> : <ChevronDownIcon size={16} color="#A1A1AA" />}
                  </button>
                  {isExpanded && (
                    <div style={{ paddingBottom: '16px' }}>
                      {chapter.lessons.map((lesson, lessonIndex) => {
                        const isCompleted = course.lessonProgress[lesson.id];
                        const isCurrent = currentLesson?.id === lesson.id;
                        return (
                          <div 
                            key={lesson.id} 
                            className="flex items-center"
                            style={{ padding: '0 32px', marginTop: lessonIndex === 0 ? '0' : '20px' }}
                          >
                            <div 
                              className={`flex items-center flex-1 rounded-lg ${isCurrent ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                              style={{ padding: '8px', gap: '12px' }}
                            >
                              <button onClick={() => selectLesson(lesson)} className="flex-1 flex items-center text-right transition" style={{ gap: '12px' }}>
                                <div className="flex-shrink-0">
                                  {getLessonIcon(lesson, isCompleted)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[#18181B] truncate" style={{ fontSize: '16px' }}>{lesson.title}</p>
                                </div>
                              </button>
                              {!isCourseAuthor && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCompleteLesson(lesson.id); }}
                                  disabled={completingLesson}
                                  className="flex items-center justify-center transition flex-shrink-0"
                                  style={{ 
                                    width: '18px', 
                                    height: '18px', 
                                    borderRadius: '50%',
                                    border: isCompleted ? 'none' : '1px solid black',
                                    backgroundColor: isCompleted ? '#A7EA7B' : 'transparent',
                                    marginRight: '8px'
                                  }}
                                >
                                  {isCompleted && <CheckIcon size={10} color="black" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
          {/* Unenroll button at bottom */}
          {course.enrollment && !isOwnerOrAuthor && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowUnenrollModal(true)}
                className="w-full py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-red-200"
              >
                ביטול הרשמה לקורס
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main ref={contentRef} onScroll={handleContentScroll} className="flex-1 bg-gray-100 overflow-y-auto" dir="ltr">
          <div dir="rtl" className="p-4 flex justify-center min-h-full">
          {currentLesson ? (
            <div className="w-full max-w-4xl">
              {/* Title Card - Detached */}
              <div className="bg-white border border-[#D4D4D8] p-6 mb-4" style={{ borderRadius: '16px' }}>
                <div className="text-center">
                  <h2 className="font-semibold text-[#18181B] mb-2" style={{ fontSize: '21px' }}>{currentLesson.title}</h2>
                  <div className="flex items-center justify-center gap-4" style={{ fontSize: '16px', color: '#000000' }}>
                    <span className="flex items-center gap-1 font-normal">
                      {(() => {
                        if (currentLesson.lessonType === 'quiz') return <><FileQuestionIcon size={16} color="#000000" /> בוחן</>;
                        const hasVideo = !!currentLesson.videoUrl;
                        const hasText = !!currentLesson.content;
                        const hasLinks = currentLesson.links && currentLesson.links.length > 0;
                        const hasImages = currentLesson.images && currentLesson.images.length > 0;
                        const contentTypes = [hasVideo, hasText, hasLinks, hasImages].filter(Boolean).length;
                        if (contentTypes > 1) return <><LayersIcon size={16} color="#000000" /> שיעור משולב</>;
                        if (hasVideo) return <><VideoIcon size={16} color="#000000" /> סרטון</>;
                        if (hasImages) return <><ImageIcon size={16} color="#000000" /> תמונות</>;
                        if (hasLinks) return <><LinkIcon size={16} color="#000000" /> קישורים</>;
                        return <><FileTextIcon size={16} color="#000000" /> שיעור טקסט</>;
                      })()}
                    </span>
                    <span className="flex items-center gap-1 font-normal"><ClockIcon size={16} color="#000000" />{currentLesson.duration} דקות</span>
                  </div>
                </div>
              </div>

              {/* Content Card - Merged for content type lessons */}
              {currentLesson.lessonType === 'content' && (() => {
                const contentOrder = currentLesson.contentOrder || ['video', 'text', 'links', 'images'];
                
                // Collect all content items that exist
                const contentItems: { type: string; render: () => React.ReactNode }[] = [];
                
                if (currentLesson.videoUrl) {
                  contentItems.push({
                    type: 'video',
                    render: () => (
                      <VideoPlayer url={getImageUrl(currentLesson.videoUrl!)} onEnded={handleVideoEnd} />
                    )
                  });
                }
                
                if (currentLesson.content) {
                  contentItems.push({
                    type: 'text',
                    render: () => (
                      <div className="prose max-w-none text-right leading-relaxed" style={{ fontSize: '18px', color: '#000000', fontWeight: 400 }} dangerouslySetInnerHTML={{ __html: currentLesson.content! }} />
                    )
                  });
                }
                
                if (currentLesson.links && currentLesson.links.length > 0) {
                  // Separate video links from regular links
                  const videoLinks = currentLesson.links.filter(link => isValidVideoUrl(link));
                  const regularLinks = currentLesson.links.filter(link => !isValidVideoUrl(link));
                  
                  // Render video links as VideoPlayer
                  videoLinks.forEach((link, i) => {
                    contentItems.push({
                      type: `video-link-${i}`,
                      render: () => (
                        <VideoPlayer url={link} onEnded={handleVideoEnd} />
                      )
                    });
                  });
                  
                  // Render regular links normally
                  if (regularLinks.length > 0) {
                    contentItems.push({
                      type: 'links',
                      render: () => (
                        <div>
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <LinkIcon size={16} color="#3B82F6" />
                            קישורים נוספים
                          </h3>
                          <div className="space-y-2">
                            {regularLinks.map((link, index) => (
                              <a
                                key={index}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setClickedLinks(prev => new Set([...prev, currentLesson.links!.indexOf(link)]))}
                                className={`block hover:underline ${clickedLinks.has(currentLesson.links!.indexOf(link)) ? 'text-gray-500' : 'text-blue-500 hover:text-blue-600'}`}
                                style={{ fontSize: '18px' }}
                              >
                                {link}
                              </a>
                            ))}
                          </div>
                        </div>
                      )
                    });
                  }
                }
                
                if (currentLesson.images && currentLesson.images.length > 0) {
                  contentItems.push({
                    type: 'images',
                    render: () => {
                      const imageCount = Math.min(currentLesson.images!.length, 6);
                      return (
                        <div className={`grid gap-2 ${
                          imageCount === 1 ? 'grid-cols-1' : 
                          imageCount === 2 ? 'grid-cols-2' : 
                          imageCount === 3 ? 'grid-cols-3' :
                          imageCount === 4 ? 'grid-cols-2' :
                          'grid-cols-3'
                        }`}>
                          {currentLesson.images!.slice(0, 6).map((image, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setViewedImages(prev => new Set([...prev, index]));
                                openLightbox(currentLesson.images!.slice(0, 6), index);
                              }}
                              className={`block relative cursor-pointer ${
                                imageCount === 3 && index === 0 ? 'col-span-3' :
                                ''
                              }`}
                            >
                              <img
                                src={getImageUrl(image)}
                                alt={`תמונה ${index + 1}`}
                                className={`w-full object-cover hover:opacity-90 transition ${
                                  imageCount === 1 ? 'max-h-[500px] rounded-xl' :
                                  imageCount === 2 ? 'h-64 rounded-xl' :
                                  imageCount === 3 && index === 0 ? 'h-64 rounded-xl' :
                                  imageCount === 3 ? 'h-40 rounded-xl' :
                                  imageCount === 4 ? 'h-48 rounded-xl' :
                                  'h-40 rounded-xl'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      );
                    }
                  });
                }
                
                // Sort by contentOrder
                const sortedItems = contentItems.sort((a, b) => {
                  const baseType = (t: string) => t.startsWith('video-link-') ? 'video' : t;
                  const aIndex = contentOrder.indexOf(baseType(a.type));
                  const bIndex = contentOrder.indexOf(baseType(b.type));
                  return aIndex - bIndex;
                });
                
                if (sortedItems.length === 0) return null;
                
                return (
                  <div className="bg-white border border-[#D4D4D8] overflow-hidden" style={{ borderRadius: '16px', paddingTop: '24px' }}>
                    {sortedItems.map((item, index) => (
                      <div key={item.type}>
                        <div className="px-6">
                          {item.render()}
                        </div>
                        {index < sortedItems.length - 1 && (
                          <div className="px-6">
                            <div className="h-px bg-[#D4D4D8] my-4" />
                          </div>
                        )}
                        {index === sortedItems.length - 1 && (
                          <div className="pb-6" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Quiz Card - only for quiz type lessons */}
              {currentLesson.lessonType === 'quiz' && currentLesson.quiz && (
                <div className="bg-white border border-[#D4D4D8]" style={{ borderRadius: '16px' }}>
                  {currentLesson.quiz.questions.map((question, qIndex) => {
                    const questionId = question.id;
                    const selectedAnswers = quizAnswers[questionId] || [];
                    const isSubmitted = quizSubmitted[questionId];
                    
                    const handleOptionClick = (optionId: string) => {
                      if (isSubmitted) return;
                      
                      if (question.questionType === 'radio') {
                        setQuizAnswers(prev => ({ ...prev, [questionId]: [optionId] }));
                      } else {
                        const newAnswers = selectedAnswers.includes(optionId)
                          ? selectedAnswers.filter(id => id !== optionId)
                          : [...selectedAnswers, optionId];
                        setQuizAnswers(prev => ({ ...prev, [questionId]: newAnswers }));
                      }
                    };
                    
                    const handleCheckAnswer = () => {
                      setQuizSubmitted(prev => {
                        const newSubmitted = { ...prev, [questionId]: true };
                        
                        // Check if this answer is correct
                        const thisAnswerCorrect = selectedAnswers.length === correctOptionIds.length && 
                          selectedAnswers.every(id => correctOptionIds.includes(id));
                        
                        // If correct, check if all questions are now answered correctly
                        if (thisAnswerCorrect && currentLesson?.quiz) {
                          const allQuestionsCorrect = currentLesson.quiz.questions.every(q => {
                            if (q.id === questionId) return thisAnswerCorrect;
                            const qCorrectIds = q.options.filter(o => o.isCorrect).map(o => o.id);
                            const qAnswers = quizAnswers[q.id] || [];
                            const isQSubmitted = newSubmitted[q.id];
                            return isQSubmitted && qAnswers.length === qCorrectIds.length && 
                              qAnswers.every(id => qCorrectIds.includes(id));
                          });
                          
                          // Auto-complete quiz if all correct
                          if (allQuestionsCorrect && !course?.lessonProgress[currentLesson.id]) {
                            setTimeout(() => handleCompleteLesson(currentLesson.id), 500);
                          }
                        }
                        
                        return newSubmitted;
                      });
                    };
                    
                    const correctOptionIds = question.options.filter(o => o.isCorrect).map(o => o.id);
                    const isCorrect = isSubmitted && 
                      selectedAnswers.length === correctOptionIds.length && 
                      selectedAnswers.every(id => correctOptionIds.includes(id));
                    
                    return (
                      <div key={questionId}>
                        {/* Divider between questions */}
                        {qIndex > 0 && <div className="border-t border-[#D4D4D8] mx-6" />}
                        
                        <div className="p-6">
                          <div className="flex items-start gap-3 mb-4">
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-800 flex items-center justify-center font-bold text-sm">
                              {qIndex + 1}
                            </span>
                            <div className="flex-1">
                              <h3 className="font-semibold text-black" style={{ fontSize: '18px' }}>{question.question}</h3>
                              <p className="font-normal mt-1" style={{ fontSize: '16px', color: '#3F3F46' }}>
                                {question.questionType === 'radio' ? 'בחר תשובה אחת' : 'בחר את כל התשובות הנכונות'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {question.options.map((option) => {
                              const isSelected = selectedAnswers.includes(option.id);
                              // Show green only when user got the answer correct
                              const showCorrect = isSubmitted && isCorrect && option.isCorrect;
                              // Show red for all selected options when answer is wrong
                              const showWrong = isSubmitted && !isCorrect && isSelected;
                              
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => handleOptionClick(option.id)}
                                  disabled={isSubmitted}
                                  className={`w-full p-4 rounded-lg border-2 text-right transition flex items-center gap-3 ${
                                    isSubmitted
                                      ? showCorrect
                                        ? 'border-[#A7EA7B] bg-white'
                                        : showWrong
                                          ? 'border-[#B3261E] bg-white'
                                          : 'border-gray-200 bg-white'
                                      : isSelected
                                        ? 'border-gray-900 bg-white'
                                        : 'border-gray-200 bg-white hover:bg-[#F4F4F5]'
                                  }`}
                                >
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                    isSubmitted
                                      ? showCorrect
                                        ? 'border-[#A7EA7B] bg-[#A7EA7B]'
                                        : showWrong
                                          ? 'border-[#B3261E] bg-[#B3261E]'
                                          : 'border-gray-300 bg-white'
                                      : isSelected
                                        ? 'border-gray-900 bg-gray-900'
                                        : 'border-gray-300 bg-white'
                                  }`}>
                                    {isSubmitted ? (
                                      showCorrect ? <CheckIcon size={14} color="black" /> : showWrong ? <CloseIcon size={14} color="white" /> : null
                                    ) : (
                                      isSelected && <CheckIcon size={14} color="white" />
                                    )}
                                  </div>
                                  <span className={`flex-1 ${
                                    isSubmitted
                                      ? showCorrect || showWrong
                                        ? 'text-gray-900'
                                        : 'text-gray-600'
                                      : 'text-gray-700'
                                  }`}>
                                    {option.text}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          
                          {!isSubmitted && selectedAnswers.length > 0 && (
                            <button
                              onClick={handleCheckAnswer}
                              className="mt-4 px-6 py-2 bg-black text-white rounded-lg font-normal hover:bg-gray-800 transition"
                              style={{ fontSize: '16px' }}
                            >
                              בדוק תשובה
                            </button>
                          )}
                          
                          {isSubmitted && (
                            <div 
                              className={`mt-4 p-4 rounded-lg flex items-center justify-between`}
                              style={{
                                backgroundColor: isCorrect ? '#D0F9C9' : 'rgba(179, 38, 30, 0.1)',
                                border: `1px solid ${isCorrect ? '#A7EA7B' : '#B3261E'}`,
                              }}
                            >
                              <span 
                                className="font-normal"
                                style={{ fontSize: '16px', color: isCorrect ? 'black' : '#B3261E' }}
                              >
                                {isCorrect ? 'נכון! כל הכבוד! 🎉' : 'תשובה לא נכונה'}
                              </span>
                              {!isCorrect && (
                                <button
                                  onClick={() => {
                                    setQuizAnswers(prev => ({ ...prev, [questionId]: [] }));
                                    setQuizSubmitted(prev => ({ ...prev, [questionId]: false }));
                                  }}
                                  className="px-4 py-1.5 bg-black text-white rounded-lg font-normal hover:bg-gray-800 transition"
                                  style={{ fontSize: '16px' }}
                                >
                                  נסה שוב
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[calc(100vh-73px)]"><p className="text-gray-500">בחר שיעור מהתפריט</p></div>
          )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" dir="rtl">
            <button
              onClick={() => !deleting && setShowDeleteModal(false)}
              className="absolute top-4 left-4 p-1 hover:bg-gray-100 rounded-full transition"
              disabled={deleting}
            >
              <CloseIcon size={20} className="text-gray-400" />
            </button>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrashIcon size={28} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">מחיקת קורס</h3>
              <p className="text-gray-600 mb-6">
                האם אתה בטוח שברצונך למחוק את הקורס <span className="font-semibold">"{course?.title}"</span>?
                <br />
                <span className="text-red-500 text-sm">פעולה זו לא ניתנת לביטול.</span>
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={handleDeleteCourse}
                  disabled={deleting}
                  className="px-6 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? 'מוחק...' : 'מחק קורס'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unenroll Confirmation Modal */}
      {showUnenrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !unenrolling && setShowUnenrollModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" dir="rtl">
            <button
              onClick={() => !unenrolling && setShowUnenrollModal(false)}
              className="absolute top-4 left-4 p-1 hover:bg-gray-100 rounded-full transition"
              disabled={unenrolling}
            >
              <CloseIcon size={20} className="text-gray-400" />
            </button>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">ביטול הרשמה לקורס</h3>
              <p className="text-gray-600 mb-6">
                האם אתה בטוח שברצונך לבטל את ההרשמה לקורס <span className="font-semibold">"{course?.title}"</span>?
                <br />
                <span className="text-orange-500 text-sm">ההתקדמות שלך בקורס תימחק.</span>
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowUnenrollModal(false)}
                  disabled={unenrolling}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                  השאר אותי רשום
                </button>
                <button
                  onClick={handleUnenroll}
                  disabled={unenrolling}
                  className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {unenrolling ? 'מבטל...' : 'בטל הרשמה'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {showLightbox && lightboxImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 p-2"
          >
            <CloseIcon size={32} />
          </button>

          {/* Image counter */}
          {lightboxImages.length > 1 && (
            <div className="absolute top-4 left-4 text-white text-lg font-medium bg-black bg-opacity-50 px-3 py-1 rounded-lg">
              {lightboxIndex + 1} / {lightboxImages.length}
            </div>
          )}

          {/* Previous button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 transition"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Next button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 transition"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Main image */}
          <img
            src={getImageUrl(lightboxImages[lightboxIndex])}
            alt={`תמונה ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Thumbnail strip for multiple images */}
          {lightboxImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black bg-opacity-50 p-2 rounded-lg">
              {lightboxImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition ${
                    idx === lightboxIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getImageUrl(img)}
                    alt={`תמונה ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CourseViewerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">טוען...</div>}>
      <CourseViewerContent />
    </Suspense>
  );
}
