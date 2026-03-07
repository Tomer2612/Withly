'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PlayIcon from '../../../components/icons/PlayIcon';
import { useCommunityContext } from '../CommunityContext';
import SearchXIcon from '../../../components/icons/SearchXIcon';
import BookIcon from '../../../components/icons/BookIcon';
import StopwatchIcon from '../../../components/icons/StopwatchIcon';
import EditIcon from '../../../components/icons/EditIcon';
import TrashIcon from '../../../components/icons/TrashIcon';
import NotebookCircleIcon from '../../../components/icons/NotebookCircleIcon';
import TrashCircleIcon from '../../../components/icons/TrashCircleIcon';
import CloseIcon from '../../../components/icons/CloseIcon';
import ChevronLeftIcon from '../../../components/icons/ChevronLeftIcon';
import ChevronRightIcon from '../../../components/icons/ChevronRightIcon';

interface Course {
  id: string;
  title: string;
  description: string;
  image: string | null;
  duration: number;
  totalLessons: number;
  totalDuration: number;
  isPublished: boolean;
  author: {
    id: string;
    name: string;
    profileImage: string | null;
  };
  enrollment: {
    progress: number;
    completedAt: string | null;
  } | null;
  _count: {
    enrollments: number;
  };
}

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  ownerId: string;
  logo?: string | null;
}

// Helper function to get visible page numbers (max 10, sliding window)
const getVisiblePages = (currentPage: number, totalPages: number): number[] => {
  const maxVisible = 10;
  let start = 1;
  let end = Math.min(totalPages, maxVisible);
  
  if (totalPages > maxVisible) {
    const halfWindow = Math.floor(maxVisible / 2);
    start = Math.max(1, currentPage - halfWindow);
    end = start + maxVisible - 1;
    
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
  }
  
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
};

export default function CoursesPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.id as string;

  const [courses, setCourses] = useState<Course[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'in-progress' | 'completed' | 'my-courses'>('all');
  const [mounted, setMounted] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; courseId: string | null; courseTitle: string }>({ open: false, courseId: null, courseTitle: '' });
  
  // Get user data and searchQuery from layout context
  const { searchQuery, setSearchQuery, userEmail, userId, userProfile, isOwner, isOwnerOrManager } = useCommunityContext();
  const [deleting, setDeleting] = useState(false);

  // Pagination state
  const [allPage, setAllPage] = useState(1);
  const [inProgressPage, setInProgressPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [myCoursesPage, setMyCoursesPage] = useState(1);
  const coursesPerPage = 3;

  useEffect(() => {
    setMounted(true);
    fetchCommunity();
    fetchCourses();
  }, [communityId]);

  // Set default tab based on user role
  useEffect(() => {
    if (isOwner) {
      setActiveTab('my-courses');
    } else {
      setActiveTab('all');
    }
  }, [isOwner]);

  const fetchCommunity = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
      if (res.ok) {
        const data = await res.json();
        
        // Redirect to slug URL if community has a slug and we're using ID
        if (data.slug && communityId !== data.slug) {
          router.replace(`/communities/${data.slug}/courses`);
          return;
        }
        
        setCommunity(data);
      }
    } catch (err) {
      console.error('Failed to fetch community:', err);
    }
  };

  const fetchCourses = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/community/${communityId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    let hoursStr = '';
    if (hours === 1) hoursStr = 'שעה';
    else if (hours === 2) hoursStr = 'שעתיים';
    else hoursStr = `${hours} שעות`;
    if (mins === 0) return hoursStr;
    return `${hoursStr} ו-${mins} דקות`;
  };

  const openDeleteModal = (courseId: string, courseTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteModal({ open: true, courseId, courseTitle });
  };

  const handleDeleteCourse = async () => {
    if (!deleteModal.courseId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${deleteModal.courseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCourses(prev => prev.filter(c => c.id !== deleteModal.courseId));
        setDeleteModal({ open: false, courseId: null, courseTitle: '' });
      }
    } catch (err) {
      console.error('Failed to delete course:', err);
    } finally {
      setDeleting(false);
    }
  };

  const canEditCourse = (course: Course) => {
    if (!userId) return false;
    // Only the course author can edit/delete
    return course.author.id === userId;
  };
  const inProgressCourses = courses.filter(c => c.enrollment && !c.enrollment.completedAt && c.author.id !== userId);
  const completedCourses = courses.filter(c => c.enrollment?.completedAt && c.author.id !== userId);
  const allCourses = courses.filter(c => c.isPublished || c.author.id === userId);
  const myCourses = courses.filter(c => c.author.id === userId);

  // Filter by search query
  const filterBySearch = (courseList: Course[]) => {
    if (!searchQuery.trim()) return courseList;
    const query = searchQuery.toLowerCase();
    return courseList.filter(c => 
      c.title.toLowerCase().includes(query) || 
      c.description?.toLowerCase().includes(query) ||
      c.author.name?.toLowerCase().includes(query)
    );
  };

  const displayedCourses = filterBySearch(
    activeTab === 'all'
      ? allCourses
      : activeTab === 'in-progress' 
        ? inProgressCourses
        : activeTab === 'my-courses'
          ? myCourses
          : completedCourses
  );

  return (
    <main className="min-h-screen bg-[#F4F4F5] text-right">
      {/* Sub header with tabs and create button */}
      <div className="bg-[#F4F4F5] border-b border-gray-200 pt-10">
        <div className="max-w-5xl mx-auto px-8 flex items-center justify-between">
          <div className="flex gap-4">
            {/* Owner sees only הקורסים שלי tab, regular users see the other 3 tabs */}
            {isOwner ? (
              <button
                onClick={() => setActiveTab('my-courses')}
                className={`px-4 py-3 text-[18px] relative transition ${
                  activeTab === 'my-courses'
                    ? 'font-semibold text-black'
                    : 'font-normal text-[#3F3F46] hover:text-gray-700'
                }`}
              >
                הקורסים שלי
                {activeTab === 'my-courses' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black"></span>}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-3 text-[18px] relative transition ${
                    activeTab === 'all'
                      ? 'font-semibold text-black'
                      : 'font-normal text-[#3F3F46] hover:text-gray-700'
                  }`}
                >
                  כל הקורסים
                  {activeTab === 'all' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black"></span>}
                </button>
                <button
                  onClick={() => setActiveTab('in-progress')}
                  className={`px-4 py-3 text-[18px] relative transition ${
                    activeTab === 'in-progress'
                      ? 'font-semibold text-black'
                      : 'font-normal text-[#3F3F46] hover:text-gray-700'
                  }`}
                >
                  קורסים בתהליך
                  {activeTab === 'in-progress' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black"></span>}
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`px-4 py-3 text-[18px] relative transition ${
                    activeTab === 'completed'
                      ? 'font-semibold text-black'
                      : 'font-normal text-[#3F3F46] hover:text-gray-700'
                  }`}
                >
                  קורסים שהושלמו
                  {activeTab === 'completed' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black"></span>}
                </button>
              </>
            )}
          </div>
          {isOwner && (
            <Link
              href={`/communities/${communityId}/courses/create`}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium text-[18px]"
            >
              יצירת קורס חדש
            </Link>
          )}
        </div>
      </div>

      {/* Course Grid */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        {displayedCourses.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            {searchQuery ? (
              <>
                <SearchXIcon className="w-16 h-16 mx-auto mb-4" />
                <p className="text-black text-lg">לא נמצאו קורסים עבור "{searchQuery}"</p>
              </>
            ) : (
              <>
                <NotebookCircleIcon className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-[21px] font-medium text-black mb-2">
                  {activeTab === 'completed' 
                    ? 'עדיין לא השלמת קורסים' 
                    : activeTab === 'in-progress'
                      ? 'עדיין לא התחלת קורסים או שהשלמת את כולם'
                      : activeTab === 'my-courses'
                        ? 'עדיין לא יצרת קורסים'
                        : 'אין קורסים זמינים'}
                </h3>
                <p className="text-lg text-[#3F3F46]">
                  {activeTab === 'completed' 
                    ? 'המשך ללמוד והקורסים שתשלים יופיעו כאן'
                    : activeTab === 'in-progress'
                      ? 'הירשם לקורס מלשונית "כל הקורסים"'
                      : activeTab === 'my-courses'
                        ? 'לחץ על "יצירת קורס חדש" כדי להתחיל'
                        : 'צור את הקורס הראשון שלך'
                  }
                </p>
              </>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...displayedCourses]
              .reverse()
              .slice(
                ((activeTab === 'all' ? allPage : activeTab === 'in-progress' ? inProgressPage : activeTab === 'my-courses' ? myCoursesPage : completedPage) - 1) * coursesPerPage,
                (activeTab === 'all' ? allPage : activeTab === 'in-progress' ? inProgressPage : activeTab === 'my-courses' ? myCoursesPage : completedPage) * coursesPerPage
              )
              .map(course => (
              <div
                key={course.id}
                className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 ease-in-out group border border-gray-100 relative w-full max-w-[432px]"
                style={{ height: '510px' }}
              >
                {/* Edit/Delete Buttons for Owner/Author */}
                {canEditCourse(course) && (
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                    <Link
                      href={`/communities/${communityId}/courses/${course.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white text-[#3F3F46] flex items-center justify-center hover:bg-gray-50 transition shadow-sm"
                      style={{ width: 32, height: 32, borderRadius: '50%' }}
                    >
                      <EditIcon className="w-4 h-4" />
                    </Link>
                    <Link
                      href="#"
                      onClick={(e) => { e.preventDefault(); openDeleteModal(course.id, course.title, e); }}
                      className="bg-white text-[#B3261E] flex items-center justify-center hover:bg-gray-50 transition shadow-sm"
                      style={{ width: 32, height: 32, borderRadius: '50%' }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Link>
                  </div>
                )}

                {/* Course Image - Clickable */}
                <Link href={`/communities/${communityId}/courses/${course.id}`} className="block">
                  <div className="relative h-[250px] bg-gray-200 overflow-hidden">
                    {course.image ? (
                      <Image
                        src={course.image.startsWith('http') ? course.image : `${process.env.NEXT_PUBLIC_API_URL}${course.image}`}
                        alt={course.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400">
                        <BookIcon className="w-16 h-16 text-white/50" />
                      </div>
                    )}
                    
                    {/* Play button overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center">
                        <PlayIcon size={36} className="text-gray-800 mr-[-2px]" />
                      </div>
                    </div>

                    {/* Unpublished badge */}
                    {!course.isPublished && (
                      <div className="absolute top-3 right-3 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded">
                        טיוטה
                      </div>
                    )}
                  </div>
                </Link>

                {/* Course Info - Clickable */}
                <Link href={`/communities/${communityId}/courses/${course.id}`} className="block p-5 overflow-hidden no-underline h-[260px]">
                  {/* Title */}
                  <h3 className="text-lg font-bold text-gray-900 mb-3 truncate">
                    {course.title}
                  </h3>

                  {/* Duration and Lessons - With icons, bg gray 2, stroke gray 3 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center gap-1.5 bg-[#F4F4F5] border border-[#E4E4E7] text-[#3F3F46] px-2.5 py-1 rounded-md text-sm font-normal whitespace-nowrap">
                      <StopwatchIcon className="w-4 h-4 flex-shrink-0" />
                      {formatDuration(course.totalDuration)}
                    </span>
                    <span className="flex items-center gap-1.5 bg-[#F4F4F5] border border-[#E4E4E7] text-[#3F3F46] px-2.5 py-1 rounded-md text-sm font-normal whitespace-nowrap">
                      <BookIcon className="w-4 h-4 flex-shrink-0" />
                      {course.totalLessons} שיעורים
                    </span>
                  </div>

                  {/* Description - 18px, regular, gray 8 */}
                  <p className="text-lg font-normal text-[#3F3F46] line-clamp-2 mb-3 min-h-[56px] break-words overflow-hidden">
                    {course.description || 'אין תיאור'}
                  </p>

                  {/* Progress Bar - Hidden for author's own courses */}
                  {course.author.id !== userId && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-500">התקדמות</span>
                        <span className="font-semibold text-gray-700">{Math.round(course.enrollment?.progress || 0)}%</span>
                      </div>
                      <div className="h-2 bg-[#D4F5C4] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#A7EA7B] rounded-full transition-all"
                          style={{ width: `${course.enrollment?.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              </div>
            ))}
          </div>
          {/* Pagination */}
          {displayedCourses.length > coursesPerPage && (() => {
            const currentPage = activeTab === 'all' ? allPage : activeTab === 'in-progress' ? inProgressPage : activeTab === 'my-courses' ? myCoursesPage : completedPage;
            const setCurrentPage = activeTab === 'all' ? setAllPage : activeTab === 'in-progress' ? setInProgressPage : activeTab === 'my-courses' ? setMyCoursesPage : setCompletedPage;
            const totalPages = Math.ceil(displayedCourses.length / coursesPerPage);
            const visiblePages = getVisiblePages(currentPage, totalPages);
            return (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`w-8 h-8 flex items-center justify-center transition ${
                    currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-[#3F3F46] hover:text-black'
                  }`}
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
                {visiblePages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`flex items-center justify-center font-medium text-[16px] transition ${
                      page === currentPage
                        ? 'bg-[#71717A] text-white'
                        : 'bg-white text-[#71717A] hover:bg-gray-50'
                    }`}
                    style={{ width: 32, height: 32, borderRadius: '50%' }}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className={`w-8 h-8 flex items-center justify-center transition ${
                    currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-[#3F3F46] hover:text-black'
                  }`}
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
              </div>
            );
          })()}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setDeleteModal({ open: false, courseId: null, courseTitle: '' })} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" dir="rtl">
            <button
              onClick={() => !deleting && setDeleteModal({ open: false, courseId: null, courseTitle: '' })}
              className="absolute top-4 left-4 p-1 hover:bg-gray-100 rounded-full transition"
              disabled={deleting}
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            <div className="text-center">
              <TrashCircleIcon className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-black mb-2">מחיקת קורס</h3>
              <p className="text-[#3F3F46] mb-6">
                האם אתה בטוח שברצונך למחוק את הקורס <span className="font-semibold">"{deleteModal.courseTitle}"</span>?
                <br />
                פעולה זו לא ניתנת לביטול.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteModal({ open: false, courseId: null, courseTitle: '' })}
                  disabled={deleting}
                  className="px-6 py-2.5 border border-black text-black rounded-xl font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={handleDeleteCourse}
                  disabled={deleting}
                  className="px-6 py-2.5 bg-[#B3261E] text-white rounded-xl font-medium hover:bg-[#9C2019] transition disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? 'מוחק...' : 'מחיקה'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
