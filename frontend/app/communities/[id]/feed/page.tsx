'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { compressImages, MAX_IMAGE_SIZE_BYTES } from '../../../lib/imageCompression';
import { isValidVideoUrl, getVideoProvider, MAX_VIDEO_SIZE_BYTES } from '../../../lib/videoUtils';
import ImageIcon from '../../../components/icons/ImageIcon';
import LinkIcon from '../../../components/icons/LinkIcon';
import { useCommunityContext } from '../CommunityContext';
import FormSelect from '../../../components/FormSelect';
import FilterDropdown from '../../../components/FilterDropdown';
import SearchXIcon from '../../../components/icons/SearchXIcon';
import ClipboardCheckIcon from '../../../components/icons/ClipboardCheckIcon';
import CalendarIcon from '../../../components/icons/CalendarIcon';
import AwardIcon from '../../../components/icons/AwardIcon';
import CheckIcon from '../../../components/icons/CheckIcon';
import UsersIcon from '../../../components/icons/UsersIcon';
import CloseIcon from '../../../components/icons/CloseIcon';
import TrashCircleIcon from '../../../components/icons/TrashCircleIcon';
import TrashIcon from '../../../components/icons/TrashIcon';
import MoreDotsIcon from '../../../components/icons/MoreDotsIcon';
import BookmarkIcon from '../../../components/icons/BookmarkIcon';
import BookmarkFilledIcon from '../../../components/icons/BookmarkFilledIcon';
import HeartIcon from '../../../components/icons/HeartIcon';
import HeartFilledIcon from '../../../components/icons/HeartFilledIcon';
import CommentIcon from '../../../components/icons/CommentIcon';
import PinIcon from '../../../components/icons/PinIcon';
import EditIcon from '../../../components/icons/EditIcon';
import FileTextIcon from '../../../components/icons/FileTextIcon';
import TrophyIcon from '../../../components/icons/TrophyIcon';
import VideoPlayer from '../../../components/VideoPlayer';
import { getImageUrl } from '@/app/lib/imageUrl';

interface Community {
  id: string;
  name: string;
  slug?: string | null;
  description: string;
  image?: string | null;
  logo?: string | null;
  ownerId: string;
  createdAt: string;
  topic?: string | null;
  memberCount?: number | null;
  rules?: string[];
  showOnlineMembers?: boolean;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    profileImage?: string | null;
  };
}

interface Post {
  id: string;
  title?: string | null;
  content: string;
  images?: string[];
  videos?: string[];
  files?: { url: string; name: string }[];
  links?: string[];
  category?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  createdAt: string;
  author: {
    id: string;
    email: string;
    name: string;
    profileImage?: string | null;
  };
  _count?: {
    likes: number;
    comments: number;
    savedBy?: number;
  };
  isLiked?: boolean;
  isSaved?: boolean;
  poll?: {
    id: string;
    question: string;
    expiresAt?: string | null;
    totalVotes: number;
    userVotedOptionId: string | null;
    options: {
      id: string;
      text: string;
      votes: number;
      percentage: number;
    }[];
  } | null;
}

// Post categories with colors
const POST_CATEGORIES = [
  { value: 'הודעות', label: 'הודעות', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'שאלות', label: 'שאלות', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'טיפים', label: 'טיפים', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'פרסום', label: 'פרסום', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
];

interface TopMember {
  rank: number;
  userId: string;
  name: string;
  email: string;
  profileImage: string | null;
  points: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  locationType: string;
  locationName?: string;
  _count?: { rsvps: number };
}

// NAV_LINKS will be generated dynamically based on communityId

function CommunityFeedContent() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;

  const [mounted, setMounted] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<string>('הודעות');
  const [newPostImages, setNewPostImages] = useState<File[]>([]);
  const [newPostFiles, setNewPostFiles] = useState<File[]>([]);
  const [newPostVideoFiles, setNewPostVideoFiles] = useState<File[]>([]);
  const [newPostVideoUrls, setNewPostVideoUrls] = useState<string[]>([]);
  const [newPostLinks, setNewPostLinks] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ name: string }[]>([]);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [addingEditLink, setAddingEditLink] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'mostLiked' | 'mostCommented'>('newest');
  
  // Edit/Delete state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]); // Existing images
  const [editFiles, setEditFiles] = useState<{ url: string; name: string }[]>([]); // Existing files
  const [editLinks, setEditLinks] = useState<string[]>([]); // Existing links
  const [newEditImages, setNewEditImages] = useState<File[]>([]); // New images to add
  const [newEditFiles, setNewEditFiles] = useState<File[]>([]); // New files to add
  const [newEditImagePreviews, setNewEditImagePreviews] = useState<string[]>([]);
  const [newEditFilePreviews, setNewEditFilePreviews] = useState<{ name: string }[]>([]);
  const [editLinkInput, setEditLinkInput] = useState('');
  const [showEditLinkInput, setShowEditLinkInput] = useState(false);
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([]);
  const [filesToRemove, setFilesToRemove] = useState<string[]>([]);
  const [linksToRemove, setLinksToRemove] = useState<string[]>([]);
  const [pollToRemove, setPollToRemove] = useState(false);
  const [editPollQuestion, setEditPollQuestion] = useState('');
  const [editPollOptions, setEditPollOptions] = useState<{ id: string; text: string }[]>([]);
  const [showEditPollCreator, setShowEditPollCreator] = useState(false);
  const [newEditPollQuestion, setNewEditPollQuestion] = useState('');
  const [newEditPollOptions, setNewEditPollOptions] = useState<string[]>(['', '']);
  const [menuOpenPostId, setMenuOpenPostId] = useState<string | null>(null);
  
  // Filter state
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  
  // Get searchQuery and user data from layout context
  const { searchQuery, setSearchQuery, userEmail, userId, userProfile, isOwner, isManager, isMember: contextIsMember, community: layoutCommunity } = useCommunityContext();
  
  // Comments state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [commentMenuOpenId, setCommentMenuOpenId] = useState<string | null>(null);
  
  // Mention autocomplete state
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; name: string; profileImage: string | null }[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState<string | null>(null); // postId where dropdown is shown
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  
  // Delete post modal state
  const [deletePostModalId, setDeletePostModalId] = useState<string | null>(null);
  
  // Link previews state
  const [linkPreviews, setLinkPreviews] = useState<Record<string, { title?: string; description?: string; image?: string; url: string }>>({});
  
  // Poll state for new post
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isMember, setIsMember] = useState<boolean | null>(contextIsMember);
  const [, setCanEdit] = useState(false);
  const [, setCanDelete] = useState(false);
  const [userMemberships, setUserMemberships] = useState<string[]>([]);
  const [topMembers, setTopMembers] = useState<TopMember[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  
  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

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

  useEffect(() => {
    setMounted(true);

    const token = localStorage.getItem('token');
    if (token && token.split('.').length === 3) {
      // Fetch user's community memberships
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/user/memberships`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setUserMemberships(data);
        })
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities`);
        if (!res.ok) throw new Error('Failed to fetch communities');
        const data = await res.json();
        setCommunities(data);
      } catch (err) {
        console.error('Error fetching communities:', err);
      }
    };

    fetchCommunities();
  }, [communityId]);

  useEffect(() => {
    const fetchCommunityDetails = async () => {
      if (!communityId) {
        setCommunity(null);
        setPosts([]);
        return;
      }

      const token = localStorage.getItem('token');
      
      try {
        setLoading(true);
        
        // First check membership
        if (token) {
          const membershipRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (membershipRes.ok) {
            const membershipData = await membershipRes.json();
            setIsMember(membershipData.isMember);
            setCanEdit(membershipData.canEdit || false);
            setCanDelete(membershipData.canDelete || false);
            
            // If not a member, don't fetch posts
            if (!membershipData.isMember) {
              const communityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
              if (communityRes.ok) {
                setCommunity(await communityRes.json());
              }
              setPosts([]);
              setLoading(false);
              return;
            }
          }
        } else {
          // Not logged in - can't be a member
          setIsMember(false);
          setCanEdit(false);
          setCanDelete(false);
          const communityRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
          if (communityRes.ok) {
            setCommunity(await communityRes.json());
          }
          setPosts([]);
          setLoading(false);
          return;
        }
        
        const [communityRes, postsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/community/${communityId}${userId ? `?userId=${userId}` : ''}`),
        ]);

        if (!communityRes.ok) {
          // Community not found - redirect to home
          console.warn(`Community ${communityId} not found`);
          setCommunity(null);
          setPosts([]);
          router.push('/');
          setLoading(false);
          return;
        }
        const communityData = await communityRes.json();
        setCommunity(communityData);
        
        // Redirect to slug URL if community has a slug and we're using ID
        if (communityData.slug && communityId !== communityData.slug) {
          router.replace(`/communities/${communityData.slug}/feed`);
        }

        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(postsData);
        } else {
          setPosts([]);
        }

        // Fetch top members
        if (token) {
          try {
            const topMembersRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/top-members`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (topMembersRes.ok) {
              const topMembersData = await topMembersRes.json();
              setTopMembers(topMembersData);
            }
          } catch (err) {
            console.error('Error fetching top members:', err);
          }
        }

        // Fetch online members count
        try {
          const onlineRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/online-count`
          );
          if (onlineRes.ok) {
            const onlineData = await onlineRes.json();
            setOnlineCount(onlineData.onlineCount);
          }
        } catch (err) {
          console.error('Error fetching online count:', err);
        }

        // Fetch upcoming events
        try {
          const eventsRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/events/community/${communityId}/upcoming?limit=3`,
            token ? { headers: { Authorization: `Bearer ${token}` } } : {}
          );
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            setUpcomingEvents(eventsData);
          }
        } catch (err) {
          console.error('Error fetching upcoming events:', err);
        }
      } catch (err) {
        console.error('Error loading community feed:', err);
        setCommunity(null);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunityDetails();
  }, [communityId, userId, communities]);

  // Refresh online count every 30 seconds
  useEffect(() => {
    if (!communityId) return;
    
    const refreshOnlineCount = async () => {
      try {
        const onlineRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/online-count`
        );
        if (onlineRes.ok) {
          const onlineData = await onlineRes.json();
          setOnlineCount(onlineData.onlineCount);
        }
      } catch (err) {
        // Silently ignore
      }
    };

    const interval = setInterval(refreshOnlineCount, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [communityId]);

  // Refresh posts (including poll data) every 15 seconds
  useEffect(() => {
    if (!communityId || !userId) return;
    
    const refreshPosts = async () => {
      try {
        const token = localStorage.getItem('token');
        const postsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/posts/community/${communityId}?userId=${userId}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        );
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(postsData);
        }
      } catch (err) {
        // Silently ignore refresh errors
      }
    };

    const interval = setInterval(refreshPosts, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, [communityId, userId]);

  // Redirect non-members to homepage
  useEffect(() => {
    if (isMember === false) {
      router.push('/');
    }
  }, [isMember, router]);

  // Fetch link previews for posts
  useEffect(() => {
    const fetchLinkPreviews = async () => {
      const allLinks: string[] = [];
      posts.forEach(post => {
        if (post.links && post.links.length > 0) {
          post.links.forEach(link => {
            if (!linkPreviews[link]) {
              allLinks.push(link);
            }
          });
        }
      });

      // Fetch previews for new links using backend endpoint
      for (const link of allLinks) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/link-preview?url=${encodeURIComponent(link)}`);
          if (res.ok) {
            const preview = await res.json();
            setLinkPreviews(prev => ({
              ...prev,
              [link]: preview
            }));
          } else {
            // Fallback to basic info
            const url = new URL(link);
            setLinkPreviews(prev => ({
              ...prev,
              [link]: {
                url: link,
                title: url.hostname.replace('www.', ''),
                description: undefined,
                image: undefined,
              }
            }));
          }
        } catch (err) {
          // Invalid URL or fetch error, use fallback
          try {
            const url = new URL(link);
            setLinkPreviews(prev => ({
              ...prev,
              [link]: {
                url: link,
                title: url.hostname.replace('www.', ''),
                description: undefined,
                image: undefined,
              }
            }));
          } catch {
            // Skip invalid URLs
          }
        }
      }
    };

    if (posts.length > 0) {
      fetchLinkPreviews();
    }
  }, [posts]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !communityId) {
      return;
    }

    // Validate poll if poll creator is open
    if (showPollCreator) {
      if (!pollQuestion.trim()) {
        alert('נא להזין שאלה לסקר');
        return;
      }
      const validOptions = pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) {
        alert('נא להזין לפחות 2 אפשרויות לסקר');
        return;
      }
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('אנא התחברו כדי לפרסם פוסט');
      return;
    }

    try {
      setPostSubmitting(true);
      
      const formData = new FormData();
      formData.append('content', newPostContent);
      if (newPostTitle.trim()) {
        formData.append('title', newPostTitle.trim());
      }
      if (newPostCategory) {
        formData.append('category', newPostCategory);
      }
      
      // Append multiple images, files, and videos
      [...newPostImages, ...newPostFiles, ...newPostVideoFiles].forEach(file => {
        formData.append('files', file);
      });
      
      // Append external video URLs
      if (newPostVideoUrls.length > 0) {
        formData.append('videoUrls', JSON.stringify(newPostVideoUrls));
      }
      
      // Append links as JSON
      if (newPostLinks.length > 0) {
        formData.append('links', JSON.stringify(newPostLinks));
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/community/${communityId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to create post');
      const newPost = await res.json();
      
      // If poll was added, create it
      if (showPollCreator && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
        try {
          const pollRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${newPost.id}/poll`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              question: pollQuestion.trim(),
              options: pollOptions.filter(o => o.trim()),
            }),
          });
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            newPost.poll = pollData;
          }
        } catch (pollErr) {
          console.error('Poll creation error:', pollErr);
        }
      }
      
      setPosts((prev) => [newPost, ...prev]);
      setNewPostContent('');
      setNewPostTitle('');
      setNewPostCategory('הודעות');
      setNewPostImages([]);
      setNewPostFiles([]);
      setNewPostVideoFiles([]);
      setNewPostVideoUrls([]);
      setNewPostLinks([]);
      setImagePreviews([]);
      setFilePreviews([]);
      setNewLinkInput('');
      setShowLinkInput(false);
      setShowPollCreator(false);
      setPollQuestion('');
      setPollOptions(['', '']);
    } catch (err) {
      console.error('Create post error:', err);
      alert('שגיאה בפרסום הפוסט');
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const inputAccept = e.target.accept;
    
    // Collect valid images and files separately
    const validImages: File[] = [];
    const validFiles: File[] = [];
    const allowedFileTypes = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'application/zip', 'application/x-rar-compressed',
    ];
    let skippedCount = 0;
    
    for (const file of files) {
      // If image input, only accept images
      if (inputAccept?.includes('image/*')) {
        if (!file.type.startsWith('image/')) {
          skippedCount++;
          continue;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          skippedCount++;
          continue;
        }
        validImages.push(file);
      } else {
        // File input - only accept allowed document types
        if (!allowedFileTypes.includes(file.type)) {
          skippedCount++;
          continue;
        }
        validFiles.push(file);
      }
    }
    
    if (skippedCount > 0) {
      if (inputAccept?.includes('image/*')) {
        setUploadError('חלק מהקבצים לא נתמכים. ניתן להעלות רק תמונות');
      } else {
        setUploadError('חלק מהקבצים לא נתמכים. פורמטים נתמכים: PDF, Word, Excel, PowerPoint, TXT, ZIP, RAR');
      }
      setTimeout(() => setUploadError(''), 5000);
    }
    
    // Process images - compress and slice to max 6 total
    if (validImages.length > 0) {
      // Compress images before adding (max 1920px, quality 0.85)
      const compressedImages = await compressImages(validImages);
      
      setNewPostImages(prev => {
        const combined = [...prev, ...compressedImages];
        return combined.slice(0, 6);
      });
      
      // Only read previews for files that will be kept (first 6 minus existing)
      const imagesToAdd = compressedImages.slice(0, Math.max(0, 6 - newPostImages.length));
      imagesToAdd.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string].slice(0, 6));
        };
        reader.readAsDataURL(file);
      });
    }
    
    // Process files - slice to max 6 total
    if (validFiles.length > 0) {
      setNewPostFiles(prev => {
        const combined = [...prev, ...validFiles];
        return combined.slice(0, 6);
      });
      
      const filesToAdd = validFiles.slice(0, Math.max(0, 6 - newPostFiles.length));
      setFilePreviews(prev => [...prev, ...filesToAdd.map(f => ({ name: f.name }))].slice(0, 6));
    }
    
    // Reset input
    e.target.value = '';
  };

  const removeSelectedImage = (index: number) => {
    setNewPostImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeSelectedFile = (index: number) => {
    setNewPostFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const isValidUrl = (string: string) => {
    try {
      const url = new URL(string);
      // Must be http or https
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return false;
      }
      // Allow localhost for development
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
      // Must have a valid hostname (at least one dot for domain)
      if (!url.hostname || !url.hostname.includes('.')) {
        return false;
      }
      // Hostname should not be just numbers (unless IP)
      const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
      if (!isIP && !/[a-zA-Z]/.test(url.hostname)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const addLink = () => {
    if (addingLink) return;
    const trimmedLink = newLinkInput.trim();
    if (trimmedLink) {
      if (!isValidUrl(trimmedLink)) {
        setLinkError('קישור לא תקין');
        return;
      }
      if (newPostLinks.length >= 3) {
        alert('ניתן להוסיף עד 3 קישורים');
        return;
      }
      if (newPostLinks.includes(trimmedLink)) {
        setLinkError('קישור זה כבר קיים');
        return;
      }
      setAddingLink(true);
      setNewPostLinks(prev => [...prev, trimmedLink]);
      setNewLinkInput('');
      setShowLinkInput(false);
      setAddingLink(false);
      setLinkError('');
    }
  };

  const removeNewLink = (index: number) => {
    setNewPostLinks(prev => prev.filter((_, i) => i !== index));
  };

  // Like/Unlike handler
  const handleToggleLike = async (postId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('אנא התחברו כדי לתת לייק');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Like toggle failed:', res.status, errorText);
        throw new Error('Failed to toggle like');
      }
      const { liked } = await res.json();

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: liked,
                _count: {
                  ...post._count,
                  likes: (post._count?.likes || 0) + (liked ? 1 : -1),
                  comments: post._count?.comments || 0,
                },
              }
            : post
        )
      );
    } catch (err) {
      console.error('Toggle like error:', err);
    }
  };

  // Edit post handler - full edit with all attachments
  const handleEditPost = async (postId: string) => {
    const token = localStorage.getItem('token');
    if (!token || !editContent.trim() || editSubmitting) return;

    setEditSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('content', editContent);
      if (editTitle.trim()) formData.append('title', editTitle.trim());
      
      // Append new images and files
      [...newEditImages, ...newEditFiles].forEach(file => {
        formData.append('files', file);
      });
      
      // Append new links (combined with kept existing links)
      const keptLinks = editLinks.filter(link => !linksToRemove.includes(link));
      if (keptLinks.length > 0) {
        formData.append('links', JSON.stringify(keptLinks));
      }
      
      // Append items to remove
      if (imagesToRemove.length > 0) {
        formData.append('imagesToRemove', JSON.stringify(imagesToRemove));
      }
      if (filesToRemove.length > 0) {
        formData.append('filesToRemove', JSON.stringify(filesToRemove));
      }
      if (linksToRemove.length > 0) {
        formData.append('linksToRemove', JSON.stringify(linksToRemove));
      }
      
      // Poll updates for existing poll only
      if (editPollQuestion && editPollOptions.length > 0) {
        formData.append('pollQuestion', editPollQuestion);
        formData.append('pollOptions', JSON.stringify(editPollOptions));
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to update post');
      const updatedPost = await res.json();
      
      // Delete poll if marked for removal
      if (pollToRemove) {
        const postToEdit = posts.find(p => p.id === postId);
        if (postToEdit?.poll) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/polls/${postToEdit.poll.id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          updatedPost.poll = null;
        }
      }

      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { 
          ...post, 
          ...updatedPost,
        } : post))
      );
      resetEditState();
    } catch (err) {
      console.error('Edit post error:', err);
      alert('שגיאה בעדכון הפוסט');
    } finally {
      setEditSubmitting(false);
    }
  };

  const resetEditState = () => {
    setEditingPostId(null);
    setEditContent('');
    setEditTitle('');
    setEditImages([]);
    setEditFiles([]);
    setEditLinks([]);
    setNewEditImages([]);
    setNewEditFiles([]);
    setNewEditImagePreviews([]);
    setNewEditFilePreviews([]);
    setEditLinkInput('');
    setShowEditLinkInput(false);
    setImagesToRemove([]);
    setFilesToRemove([]);
    setLinksToRemove([]);
    setPollToRemove(false);
    setEditPollQuestion('');
    setEditPollOptions([]);
    setShowEditPollCreator(false);
    setNewEditPollQuestion('');
    setNewEditPollOptions(['', '']);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxImages = 6;
    const maxFiles = 6;
    
    // Calculate current totals
    const currentImageCount = editImages.length - imagesToRemove.length + newEditImages.length;
    const currentFileCount = editFiles.length - filesToRemove.length + newEditFiles.length;
    
    // Collect valid images and files
    const validImages: File[] = [];
    const validFiles: File[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        validImages.push(file);
      } else {
        validFiles.push(file);
      }
    }
    
    // Process images - limit to max allowed
    const imagesToAdd = validImages.slice(0, Math.max(0, maxImages - currentImageCount));
    if (imagesToAdd.length > 0) {
      setNewEditImages(prev => [...prev, ...imagesToAdd]);
      
      imagesToAdd.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewEditImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
    
    // Process files - limit to max allowed
    const filesToAdd = validFiles.slice(0, Math.max(0, maxFiles - currentFileCount));
    if (filesToAdd.length > 0) {
      setNewEditFiles(prev => [...prev, ...filesToAdd]);
      setNewEditFilePreviews(prev => [...prev, ...filesToAdd.map(f => ({ name: f.name }))]);
    }
    
    e.target.value = '';
  };

  const removeNewEditImage = (index: number) => {
    setNewEditImages(prev => prev.filter((_, i) => i !== index));
    setNewEditImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewEditFile = (index: number) => {
    setNewEditFiles(prev => prev.filter((_, i) => i !== index));
    setNewEditFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const undoRemoveImage = (image: string) => {
    // Check if undoing would exceed limit
    const currentKept = editImages.length - imagesToRemove.length + 1; // +1 for the one being restored
    const totalAfterUndo = currentKept + newEditImages.length;
    if (totalAfterUndo > 6) {
      alert('לא ניתן לבטל - חריגה ממגבלת 6 תמונות. הסר תמונה חדשה קודם.');
      return;
    }
    setImagesToRemove(prev => prev.filter(i => i !== image));
  };

  const undoRemoveFile = (fileUrl: string) => {
    // Check if undoing would exceed limit
    const currentKept = editFiles.length - filesToRemove.length + 1; // +1 for the one being restored
    const totalAfterUndo = currentKept + newEditFiles.length;
    if (totalAfterUndo > 6) {
      alert('לא ניתן לבטל - חריגה ממגבלת 6 קבצים. הסר קובץ חדש קודם.');
      return;
    }
    setFilesToRemove(prev => prev.filter(f => f !== fileUrl));
  };

  const addEditLink = () => {
    if (addingEditLink) return;
    const trimmedLink = editLinkInput.trim();
    if (trimmedLink) {
      const currentTotal = editLinks.length - linksToRemove.length;
      if (currentTotal >= 3) {
        alert('ניתן להוסיף עד 3 קישורים');
        return;
      }
      if (editLinks.includes(trimmedLink) && !linksToRemove.includes(trimmedLink)) {
        alert('קישור זה כבר קיים');
        return;
      }
      setAddingEditLink(true);
      setEditLinks(prev => [...prev, trimmedLink]);
      setEditLinkInput('');
      setAddingEditLink(false);
    }
  };

  const removeEditLink = (link: string) => {
    if (editLinks.includes(link)) {
      // Mark existing link for removal
      setLinksToRemove(prev => [...prev, link]);
    }
  };

  const undoRemoveEditLink = (link: string) => {
    // Check if undoing would exceed limit
    const currentKept = editLinks.length - linksToRemove.length + 1; // +1 for the one being restored
    if (currentKept > 10) {
      alert('לא ניתן לבטל - חריגה ממגבלת 10 קישורים.');
      return;
    }
    setLinksToRemove(prev => prev.filter(l => l !== link));
  };

  // Download file handler
  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save/Unsave handler
  const handleToggleSave = async (postId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('אנא התחברו כדי לשמור פוסט');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}/save`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to toggle save');
      const { saved } = await res.json();

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isSaved: saved,
                _count: {
                  ...post._count,
                  likes: post._count?.likes || 0,
                  comments: post._count?.comments || 0,
                  savedBy: (post._count?.savedBy || 0) + (saved ? 1 : -1),
                },
              }
            : post
        )
      );
    } catch (err) {
      console.error('Toggle save error:', err);
    }
  };

  // Pin/Unpin handler (owner/manager only)
  const handleTogglePin = async (postId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}/pin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'שגיאה בהצמדת הפוסט');
        return;
      }

      const updatedPost = await res.json();

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, isPinned: updatedPost.isPinned, pinnedAt: updatedPost.pinnedAt }
            : post
        ).sort((a, b) => {
          // Re-sort: pinned first, then by pinnedAt, then by createdAt
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (a.isPinned && b.isPinned) {
            return new Date(b.pinnedAt || 0).getTime() - new Date(a.pinnedAt || 0).getTime();
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
      );
    } catch (err) {
      console.error('Toggle pin error:', err);
    }
  };

  // Delete post handler
  const handleDeletePost = async (postId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete post');
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setDeletePostModalId(null);
    } catch (err) {
      console.error('Delete post error:', err);
      alert('שגיאה במחיקת הפוסט');
    }
  };

  // Load comments for a post
  const handleLoadComments = async (postId: string) => {
    if (expandedComments[postId]) {
      setExpandedComments((prev) => ({ ...prev, [postId]: false }));
      return;
    }

    setLoadingComments((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}/comments`);
      if (!res.ok) throw new Error('Failed to load comments');
      const comments = await res.json();
      setPostComments((prev) => ({ ...prev, [postId]: comments }));
      setExpandedComments((prev) => ({ ...prev, [postId]: true }));
    } catch (err) {
      console.error('Load comments error:', err);
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Add comment handler
  const handleAddComment = async (postId: string) => {
    const token = localStorage.getItem('token');
    const content = newCommentContent[postId]?.trim();
    if (!token || !content || submittingComment[postId]) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error('Failed to add comment');
      const newComment = await res.json();

      setPostComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setNewCommentContent((prev) => ({ ...prev, [postId]: '' }));
      
      // Update comment count
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                _count: {
                  ...post._count,
                  likes: post._count?.likes || 0,
                  comments: (post._count?.comments || 0) + 1,
                },
              }
            : post
        )
      );
    } catch (err) {
      console.error('Add comment error:', err);
      alert('שגיאה בהוספת התגובה');
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Search users for @mention autocomplete
  const searchUsersForMention = async (query: string) => {
    if (!query || query.length < 1) {
      setMentionSuggestions([]);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const users = await res.json();
        setMentionSuggestions(users);
      }
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  // Handle comment input change with @mention detection
  const handleCommentInputChange = (postId: string, value: string, cursorPosition: number) => {
    setNewCommentContent((prev) => ({ ...prev, [postId]: value }));
    
    // Find if we're typing after an @
    const textBeforeCursor = value.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@([\w\u0590-\u05FF]*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setMentionCursorPos(cursorPosition);
      setShowMentionDropdown(postId);
      searchUsersForMention(query);
    } else {
      setShowMentionDropdown(null);
      setMentionSuggestions([]);
    }
  };

  // Insert selected mention into comment
  const insertMention = (postId: string, userName: string) => {
    const currentContent = newCommentContent[postId] || '';
    const textBeforeCursor = currentContent.slice(0, mentionCursorPos);
    const textAfterCursor = currentContent.slice(mentionCursorPos);
    
    // Find and replace the @query with @username
    const mentionMatch = textBeforeCursor.match(/@([\w\u0590-\u05FF]*)$/);
    if (mentionMatch) {
      const newTextBeforeCursor = textBeforeCursor.slice(0, -mentionMatch[0].length) + '@' + userName + ' ';
      setNewCommentContent((prev) => ({ ...prev, [postId]: newTextBeforeCursor + textAfterCursor }));
    }
    
    setShowMentionDropdown(null);
    setMentionSuggestions([]);
  };

  // Vote on poll handler
  const handleVotePoll = async (pollId: string, optionId: string, postId: string, currentVotedOptionId: string | null) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('אנא התחברו כדי להצביע');
      return;
    }

    setVotingPollId(pollId);
    try {
      // If clicking the same option, remove the vote
      if (currentVotedOptionId === optionId) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/polls/${pollId}/vote`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const updatedPoll = await res.json();
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, poll: updatedPoll } : p
            )
          );
        }
      } else {
        // Vote for new option
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/polls/${pollId}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ optionId }),
        });

        if (res.ok) {
          const updatedPoll = await res.json();
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, poll: updatedPoll } : p
            )
          );
        }
      }
    } catch (err) {
      console.error('Vote poll error:', err);
      alert('שגיאה בהצבעה');
    } finally {
      setVotingPollId(null);
    }
  };

  // Delete poll handler
  const handleDeletePoll = async (pollId: string, postId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('אנא התחברו כדי למחוק סקר');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/polls/${pollId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Remove poll from the post
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, poll: null } : p
          )
        );
        // Reset poll creator state so user can create a new poll
        setEditPollQuestion('');
        setEditPollOptions([]);
        setShowEditPollCreator(false);
        setNewEditPollQuestion('');
        setNewEditPollOptions(['', '']);
      } else {
        alert('שגיאה במחיקת הסקר');
      }
    } catch (err) {
      console.error('Delete poll error:', err);
      alert('שגיאה במחיקת הסקר');
    }
  };

  // Delete comment handler
  const handleDeleteComment = async (commentId: string, postId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete comment');

      setPostComments((prev) => ({
        ...prev,
        [postId]: prev[postId]?.filter((c) => c.id !== commentId) || [],
      }));
      
      // Update comment count
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                _count: {
                  ...post._count,
                  likes: post._count?.likes || 0,
                  comments: Math.max((post._count?.comments || 0) - 1, 0),
                },
              }
            : post
        )
      );
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  // Edit comment handler
  const handleEditComment = async (commentId: string, postId: string) => {
    const token = localStorage.getItem('token');
    const content = editCommentContent.trim();
    if (!token || !content) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error('Failed to edit comment');
      const updatedComment = await res.json();

      setPostComments((prev) => ({
        ...prev,
        [postId]: prev[postId]?.map((c) =>
          c.id === commentId ? { ...c, content: updatedComment.content } : c
        ) || [],
      }));
      setEditingCommentId(null);
      setEditCommentContent('');
    } catch (err) {
      console.error('Edit comment error:', err);
      alert('שגיאה בעריכת התגובה');
    }
  };

  if (!communityId && !loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-600">
        <div className="text-center space-y-4">
          <p className="text-xl">אין קהילות להצגה כרגע.</p>
          <Link
            href="/communities/create"
            className="inline-flex flex-row-reverse items-center gap-2 bg-black text-white px-6 py-3 rounded-full"
          >
            <span className="inline-flex items-center justify-center text-xl leading-none">+</span>
            צרו קהילה חדשה
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-right">
      {/* Main 3-column layout - only show if member */}
      {isMember !== false && (
      <section className="flex">
        {/* LEFT: Fixed sidebar - full height */}
        <div className="hidden lg:block w-[240px] flex-shrink-0 bg-white border-l border-gray-200 fixed top-[72px] right-0 bottom-0" style={{ padding: '16px' }}>
          {/* Recent Posts button */}
          <div className="mb-2">
            <button 
              onClick={() => setShowSavedOnly(false)}
              className={`w-full px-4 py-3 flex items-center gap-3 rounded-xl ${
                !showSavedOnly 
                  ? 'bg-gray-950 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg 
                viewBox="0 0 16 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 flex-shrink-0"
              >
                <path 
                  d="M4.66675 1.33203H11.3334" 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M3.33325 4H12.6666" 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M12.6667 6.66797H3.33333C2.59695 6.66797 2 7.26492 2 8.0013V13.3346C2 14.071 2.59695 14.668 3.33333 14.668H12.6667C13.403 14.668 14 14.071 14 13.3346V8.0013C14 7.26492 13.403 6.66797 12.6667 6.66797Z" 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ fontSize: '16px' }} className="font-normal">פוסטים אחרונים</span>
            </button>
          </div>

          {/* Saved Posts button */}
          {userEmail && (
            <div className="mb-2">
              <button 
                onClick={() => setShowSavedOnly(true)}
                className={`w-full px-4 py-3 flex items-center gap-3 rounded-xl ${
                  showSavedOnly 
                    ? 'bg-gray-950 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg 
                  viewBox="0 0 16 16" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 flex-shrink-0"
                >
                  <path 
                    d="M12.6666 14L7.99992 11.3333L3.33325 14V3.33333C3.33325 2.97971 3.47373 2.64057 3.72378 2.39052C3.97382 2.14048 4.31296 2 4.66659 2H11.3333C11.6869 2 12.026 2.14048 12.2761 2.39052C12.5261 2.64057 12.6666 2.97971 12.6666 3.33333V14Z" 
                    stroke="currentColor" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <span style={{ fontSize: '16px' }} className="font-normal">פוסטים שמורים</span>
              </button>
            </div>
          )}
        </div>

        {/* Spacer for fixed sidebar */}
        <div className="hidden lg:block w-[240px] flex-shrink-0"></div>

        {/* Main content area */}
        <div className="flex-1 py-6 px-4 lg:px-6">
          {/* Mobile filters - shown on mobile only */}
          <div className="lg:hidden mb-4 space-y-2">
            <button 
              onClick={() => setShowSavedOnly(false)}
              className={`w-full rounded-xl px-4 py-2.5 flex items-center gap-3 ${
                !showSavedOnly ? 'bg-gray-950 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <svg 
                viewBox="0 0 16 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 flex-shrink-0"
              >
                <path 
                  d="M4.66675 1.33203H11.3334" 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M3.33325 4H12.6666" 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M12.6667 6.66797H3.33333C2.59695 6.66797 2 7.26492 2 8.0013V13.3346C2 14.071 2.59695 14.668 3.33333 14.668H12.6667C13.403 14.668 14 14.071 14 13.3346V8.0013C14 7.26492 13.403 6.66797 12.6667 6.66797Z" 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ fontSize: '16px' }} className="font-normal">פוסטים אחרונים</span>
            </button>
            {userEmail && (
              <button 
                onClick={() => setShowSavedOnly(true)}
                className={`w-full rounded-xl px-4 py-2.5 flex items-center gap-3 ${
                  showSavedOnly ? 'bg-gray-950 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <svg 
                  viewBox="0 0 16 16" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 flex-shrink-0"
                >
                  <path 
                    d="M12.6666 14L7.99992 11.3333L3.33325 14V3.33333C3.33325 2.97971 3.47373 2.64057 3.72378 2.39052C3.97382 2.14048 4.31296 2 4.66659 2H11.3333C11.6869 2 12.026 2.14048 12.2761 2.39052C12.5261 2.64057 12.6666 2.97971 12.6666 3.33333V14Z" 
                    stroke="currentColor" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <span style={{ fontSize: '16px' }} className="font-normal">פוסטים שמורים</span>
              </button>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setCategoryFilter('')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  categoryFilter === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                הכל
              </button>
              {POST_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    categoryFilter === cat.value ? cat.color + ' ring-1 ring-gray-400' : cat.color + ' opacity-60'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Mobile sorting */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              <span className="text-xs text-gray-500 w-full mb-1">מיון:</span>
              <button
                onClick={() => setSortBy('newest')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  sortBy === 'newest' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                חדש ביותר
              </button>
              <button
                onClick={() => setSortBy('oldest')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  sortBy === 'oldest' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                ישן ביותר
              </button>
              <button
                onClick={() => setSortBy('mostLiked')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  sortBy === 'mostLiked' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                הכי אהוב
              </button>
              <button
                onClick={() => setSortBy('mostCommented')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  sortBy === 'mostCommented' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                הכי מדובר
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] max-w-5xl mx-auto">

          {/* CENTER: Posts feed */}
          <div className="space-y-6">
            {/* Post composer - hide when viewing saved posts */}
            {userEmail && !showSavedOnly && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  {userProfile?.profileImage ? (
                    <img 
                      src={getImageUrl(userProfile.profileImage)}
                      alt={userProfile.name || 'User'}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center font-bold text-pink-600 flex-shrink-0">
                      {userProfile?.name?.charAt(0) || userEmail.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <input
                    type="text"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder="כותרת אופציונלית"
                    className="flex-1 text-right font-normal placeholder-gray-500 focus:outline-none"
                    style={{ fontSize: '16px', color: '#374151' }}
                  />
                  {/* Category selector */}
                  <FilterDropdown
                    value={newPostCategory}
                    onChange={setNewPostCategory}
                    placeholder="קטגוריה"
                    options={POST_CATEGORIES.map(cat => ({ value: cat.value, label: cat.label }))}
                    size="small"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="שתפו משהו עם הקהילה..."
                      className="w-full text-right text-gray-600 placeholder-gray-400 focus:outline-none resize-none"
                      rows={3}
                    />
                  </div>
                </div>
                
                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="h-24 w-24 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          onClick={() => removeSelectedImage(index)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#B3261E] flex items-center justify-center"
                        >
                          <CloseIcon className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                    {newPostImages.length < 6 && (
                      <span className="text-xs text-gray-400 self-center">({newPostImages.length}/6)</span>
                    )}
                  </div>
                )}
                
                {/* File Previews */}
                {filePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {filePreviews.map((file, index) => (
                      <div key={index} className="relative flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        {file.name.endsWith('.pdf') ? (
                          <FileTextIcon size={20} color="#6B7280" />
                        ) : (
                          <FileTextIcon size={20} color="#6B7280" />
                        )}
                        <span className="text-sm text-gray-700 max-w-[150px] truncate">{file.name}</span>
                        <button
                          onClick={() => removeSelectedFile(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <CloseIcon size={12} />
                        </button>
                      </div>
                    ))}
                    {newPostFiles.length < 6 && (
                      <span className="text-xs text-gray-400 self-center">({newPostFiles.length}/6)</span>
                    )}
                  </div>
                )}
                
                {/* Video Previews */}
                {(newPostVideoFiles.length > 0 || newPostVideoUrls.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {newPostVideoFiles.map((file, index) => (
                      <div key={`vf-${index}`} className="relative flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-gray-500"><rect x="2" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M14 8.5L18 6V14L14 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-sm text-gray-700 max-w-[150px] truncate">{file.name}</span>
                        <button onClick={() => setNewPostVideoFiles(prev => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-600">
                          <CloseIcon size={12} />
                        </button>
                      </div>
                    ))}
                    {newPostVideoUrls.map((url, index) => (
                      <div key={`vu-${index}`} className="relative flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-gray-500"><rect x="2" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M14 8.5L18 6V14L14 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-sm text-gray-700 max-w-[200px] truncate" dir="ltr">{url}</span>
                        <button onClick={() => setNewPostVideoUrls(prev => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-600">
                          <CloseIcon size={12} />
                        </button>
                      </div>
                    ))}
                    <span className="text-xs text-gray-400 self-center">({newPostVideoFiles.length + newPostVideoUrls.length}/3)</span>
                  </div>
                )}
                
                {/* Links List - Always visible when links exist */}
                {newPostLinks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {newPostLinks.map((link, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1 border border-gray-200">
                        <LinkIcon size={12} color="#6B7280" />
                        <span className="text-sm text-gray-700 max-w-[200px] truncate">{link}</span>
                        <button
                          onClick={() => removeNewLink(index)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <CloseIcon size={12} />
                        </button>
                      </div>
                    ))}
                    <span className="text-xs text-gray-400 self-center">({newPostLinks.length}/3)</span>
                  </div>
                )}

                {/* Link Input */}
                {showLinkInput && (
                  <div className="mt-3">
                    <div className="flex items-center gap-4 mb-2" style={{ position: 'relative' }}>
                      <input
                        type="url"
                        value={newLinkInput}
                        onChange={(e) => { setNewLinkInput(e.target.value); setLinkError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                        placeholder="https://example.com"
                        className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black placeholder:text-[#7A7A83] placeholder:font-normal ${newLinkInput.trim() ? 'text-black' : 'text-[#7A7A83]'}`}
                        style={{ fontSize: '14px', fontWeight: 400 }}
                        disabled={addingLink}
                      />
                      <button
                        onClick={addLink}
                        disabled={!newLinkInput.trim() || addingLink}
                        className={`px-3 py-2 rounded-lg text-sm transition ${
                          newLinkInput.trim() 
                            ? 'bg-[#91DCED] text-black hover:bg-[#7ad0e3]' 
                            : 'bg-[#c4ebf5] text-[#A1A1AA] cursor-not-allowed'
                        }`}
                        style={{ fontSize: '14px', fontWeight: 400 }}
                      >
                        {addingLink ? '...' : 'הוסף'}
                      </button>
                      <button
                        onClick={() => { setShowLinkInput(false); setNewLinkInput(''); setLinkError(''); }}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <CloseIcon size={16} color="currentColor" />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Poll Creator */}
                {showPollCreator && (
                  <div className="mt-3 bg-white border border-gray-300 rounded-xl p-6 shadow-sm" dir="rtl">
                    {/* Header: Title + Close Button */}
                    <div className="flex justify-between items-start mb-4">
                      <h2 style={{ fontSize: '16px' }} className="font-semibold text-black">יצירת סקר</h2>
                      <button 
                        onClick={() => {
                          setShowPollCreator(false);
                          setPollQuestion('');
                          setPollOptions(['', '']);
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <CloseIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Poll Question Input */}
                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="שאלת הסקר..."
                      style={{ fontSize: '14px' }}
                      className="w-full bg-gray-200 rounded-lg p-3 text-gray-800 font-normal focus:outline-none focus:ring-1 focus:ring-gray-400 mb-4 text-right placeholder-gray-500"
                    />

                    {/* Poll Options */}
                    <div className="space-y-3">
                      {pollOptions.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...pollOptions];
                              newOptions[index] = e.target.value;
                              setPollOptions(newOptions);
                            }}
                            placeholder={`אפשרות ${index + 1}`}
                            style={{ fontSize: '14px' }}
                            className="flex-1 bg-white border border-gray-300 rounded-lg p-3 text-gray-800 font-normal focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-black text-right placeholder-gray-500"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                              className="p-2 text-gray-400 hover:text-gray-600"
                            >
                              <CloseIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Option Button */}
                    {pollOptions.length < 4 && (
                      <button
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        style={{ fontSize: '14px' }}
                        className="mt-3 text-gray-800 font-normal underline hover:opacity-80"
                      >
                        הוסף אפשרות
                      </button>
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-start mt-3">
                  {/* Attachment buttons */}
                  <div>
                    <div className="flex items-center gap-2">
                    <label className="cursor-pointer w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
                      <ImageIcon size={20} color="currentColor" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={newPostImages.length >= 6}
                      />
                    </label>
                    
                    <label className="cursor-pointer w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                        <path d="M4.99992 18.3346C4.55789 18.3346 4.13397 18.159 3.82141 17.8465C3.50885 17.5339 3.33325 17.11 3.33325 16.668V3.33464C3.33325 2.89261 3.50885 2.46869 3.82141 2.15613C4.13397 1.84357 4.55789 1.66797 4.99992 1.66797H11.6666C11.9304 1.66754 12.1917 1.71931 12.4354 1.82028C12.6791 1.92125 12.9004 2.06944 13.0866 2.2563L16.0766 5.2463C16.264 5.43256 16.4126 5.65409 16.5138 5.89811C16.6151 6.14212 16.667 6.40378 16.6666 6.66797V16.668C16.6666 17.11 16.491 17.5339 16.1784 17.8465C15.8659 18.159 15.4419 18.3346 14.9999 18.3346H4.99992Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M11.6667 1.66797V5.83464C11.6667 6.05565 11.7545 6.26761 11.9108 6.42389C12.0671 6.58017 12.2791 6.66797 12.5001 6.66797H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={newPostFiles.length >= 6}
                      />
                    </label>
                    
                    {/* Video upload */}
                    <label className="cursor-pointer w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                        <rect x="2" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <path d="M14 8.5L18 6V14L14 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith('video/')) {
                              setUploadError('ניתן להעלות רק קבצי וידאו');
                              setTimeout(() => setUploadError(''), 5000);
                              e.target.value = '';
                              return;
                            }
                            if (file.size > MAX_VIDEO_SIZE_BYTES) {
                              setUploadError('גודל הקובץ חורג מ-100MB');
                              setTimeout(() => setUploadError(''), 5000);
                              e.target.value = '';
                              return;
                            }
                            setNewPostVideoFiles(prev => [...prev, file]);
                          }
                          e.target.value = '';
                        }}
                        className="hidden"
                        disabled={newPostVideoFiles.length + newPostVideoUrls.length >= 3}
                      />
                    </label>
                    
                    <button
                      onClick={() => setShowLinkInput(!showLinkInput)}
                      style={{ width: 36, height: 36, borderRadius: '50%' }}
                      className={`flex items-center justify-center transition ${showLinkInput ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                        <path d="M8.33325 10.834C8.69113 11.3124 9.14772 11.7083 9.67204 11.9947C10.1964 12.2812 10.7762 12.4516 11.3721 12.4942C11.9681 12.5369 12.5662 12.4509 13.126 12.2421C13.6858 12.0333 14.1942 11.7065 14.6166 11.284L17.1166 8.78396C17.8756 7.99811 18.2956 6.9456 18.2861 5.85312C18.2766 4.76063 17.8384 3.71558 17.0658 2.94304C16.2933 2.17051 15.2482 1.73231 14.1558 1.72281C13.0633 1.71332 12.0108 2.1333 11.2249 2.89229L9.79159 4.31729" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M11.6666 9.16702C11.3087 8.68858 10.8521 8.2927 10.3278 8.00623C9.80347 7.71977 9.22367 7.54942 8.62771 7.50674C8.03176 7.46406 7.4336 7.55004 6.8738 7.75887C6.314 7.96769 5.80566 8.29446 5.38326 8.71702L2.88326 11.217C2.12426 12.0029 1.70429 13.0554 1.71378 14.1479C1.72327 15.2403 2.16148 16.2854 2.93401 17.0579C3.70655 17.8305 4.7516 18.2687 5.84408 18.2782C6.93657 18.2877 7.98908 17.8677 8.77492 17.1087L10.1999 15.6837" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => setShowPollCreator(!showPollCreator)}
                      style={{ width: 36, height: 36, borderRadius: '50%' }}
                      className={`flex items-center justify-center transition ${showPollCreator ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                        <rect x="3" y="18" width="14" height="1.25" rx="0.5" fill="currentColor"/>
                        <rect x="4.75" y="5" width="3" height="12" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <rect x="8.5" y="1" width="3" height="16" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <rect x="12.25" y="8" width="3" height="9" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </button>
                    </div>
                    {uploadError && (
                      <div className="text-xs mt-1 px-1" style={{ color: '#B3261E' }}>{uploadError}</div>
                    )}
                    {linkError && (
                      <div className="text-xs mt-1 px-1" style={{ color: '#B3261E' }}>{linkError}</div>
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => handleCreatePost(e as unknown as React.FormEvent)}
                    disabled={postSubmitting || !newPostContent.trim()}
                    className={`px-5 py-2 rounded-lg font-normal flex items-center gap-2 ${
                      !newPostContent.trim() 
                        ? 'bg-gray-400 text-gray-500 cursor-not-allowed' 
                        : 'bg-black text-white hover:opacity-90'
                    }`}
                  >
                    {postSubmitting ? (
                      <span>...</span>
                    ) : (
                      <span>פרסם</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Sort and Filter Row */}
            <div className="flex items-center">
              {/* Filter by category */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '16px' }} className="font-normal text-black">סינון לפי</span>
                <FilterDropdown
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  placeholder="קטגוריה"
                  allLabel="כל הקטגוריות"
                  options={POST_CATEGORIES.map(cat => ({ value: cat.value, label: cat.label }))}
                  size="small"
                />
              </div>
              
              {/* Divider - vertical line */}
              <div style={{ marginLeft: '16px', marginRight: '16px', width: '1px', height: '24px', backgroundColor: '#9ca3af' }}></div>
              
              {/* Sort by */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '16px' }} className="font-normal text-black">מיון לפי</span>
                <FilterDropdown
                  value={sortBy}
                  onChange={(val) => setSortBy(val as 'newest' | 'oldest' | 'mostLiked' | 'mostCommented')}
                  placeholder="מיון"
                  options={[
                    { value: 'newest', label: 'חדש ביותר' },
                    { value: 'oldest', label: 'ישן ביותר' },
                    { value: 'mostLiked', label: 'הכי אהוב' },
                    { value: 'mostCommented', label: 'הכי מדובר' },
                  ]}
                  size="small"
                />
              </div>
            </div>

            {/* Posts list */}
            <div className="space-y-4">
              {loading ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
                  טוען פוסטים...
                </div>
              ) : (() => {
                const filteredPosts = posts
                  .filter(p => !showSavedOnly || p.isSaved)
                  .filter(p => !categoryFilter || p.category === categoryFilter)
                  .filter(p => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      p.content?.toLowerCase().includes(query) ||
                      p.title?.toLowerCase().includes(query) ||
                      p.author?.name?.toLowerCase().includes(query)
                    );
                  })
                  .sort((a, b) => {
                    // Pinned posts always first
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    // Then sort by selected criteria
                    if (sortBy === 'newest') {
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    } else if (sortBy === 'oldest') {
                      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    } else if (sortBy === 'mostLiked') {
                      return (b._count?.likes || 0) - (a._count?.likes || 0);
                    } else if (sortBy === 'mostCommented') {
                      return (b._count?.comments || 0) - (a._count?.comments || 0);
                    }
                    return 0;
                  });
                
                return filteredPosts.length > 0 ? (
                  filteredPosts.map((post) => (
                  <div key={post.id} className={`bg-white border rounded-2xl p-5 ${post.isPinned ? 'border-[#3F3F46] border-2' : 'border-gray-200'}`}>
                    {/* Post Header */}
                    <div className="flex items-start gap-3 mb-4">
                      {/* Profile picture - rightmost (RTL) */}
                      <Link href={`/profile/${post.author?.id}`} className="cursor-pointer hover:opacity-80 transition">
                        {post.author?.profileImage ? (
                          <img 
                            src={getImageUrl(post.author.profileImage)} 
                            alt={post.author.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center font-bold text-pink-600">
                            {post.author?.name?.charAt(0) || '?'}
                          </div>
                        )}
                      </Link>
                      
                      {/* Author info - next to profile pic */}
                      <div className="flex-1 text-right">
                        <Link href={`/profile/${post.author?.id}`} className="font-medium text-black hover:underline">
                          {post.author?.name || 'משתמש אנונימי'}
                        </Link>
                        <p className="text-sm text-[#52525B]">
                          {(() => {
                            const date = new Date(post.createdAt);
                            const day = date.getDate();
                            const months = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
                            return `${day} ${months[date.getMonth()]}`;
                          })()}
                          {post.category && (
                            <> · {POST_CATEGORIES.find(c => c.value === post.category)?.label || post.category}</>
                          )}
                        </p>
                      </div>
                      
                      {/* Actions - leftmost (RTL) */}
                      {/* Pinned indicator - beside save icon */}
                      {post.isPinned && (
                        <div className="flex items-center gap-1.5 text-[#52525B] text-sm font-medium px-2 py-1 rounded-lg">
                          <PinIcon className="w-3 h-3" />
                          <span>פוסט מוצמד</span>
                        </div>
                      )}
                      {/* Save button */}
                      {userEmail && (
                        <button
                          onClick={() => handleToggleSave(post.id)}
                          className={`p-2 rounded-full transition ${
                            post.isSaved ? 'text-[#52525B]' : 'text-[#52525B] hover:bg-gray-100'
                          }`}
                          title={post.isSaved ? 'הסר משמורים' : 'שמור פוסט'}
                        >
                          {post.isSaved ? <BookmarkFilledIcon className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
                        </button>
                      )}
                      {/* Post menu for author OR owner/manager */}
                      {(userId === post.author?.id || isOwner || isManager) && (
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenPostId(menuOpenPostId === post.id ? null : post.id)}
                            className="p-2 text-[#52525B] rounded-full hover:bg-gray-100 transition"
                          >
                            <MoreDotsIcon className="w-4 h-4" />
                          </button>
                          {menuOpenPostId === post.id && (
                            <div className="absolute left-0 top-full mt-1 bg-white border border-[#E4E4E7] rounded-xl shadow-lg z-10 min-w-[160px] p-1">
                              {/* Pin/Unpin - only for owner/manager */}
                              {(isOwner || isManager) && (
                                <button
                                  onClick={() => {
                                    handleTogglePin(post.id);
                                    setMenuOpenPostId(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-right text-sm rounded-lg hover:bg-[#F4F4F5] flex items-center gap-3 transition text-[#3F3F46]"
                                >
                                  <PinIcon className="w-3.5 h-3.5" />
                                  {post.isPinned ? 'בטל הצמדה' : 'הצמד פוסט'}
                                </button>
                              )}
                              {/* Edit - only for author */}
                              {userId === post.author?.id && (
                                <button
                                  onClick={() => {
                                    setEditingPostId(post.id);
                                    setEditTitle(post.title || '');
                                    setEditContent(post.content);
                                    setEditImages(post.images || []);
                                    setEditFiles(post.files || []);
                                    setEditLinks(post.links || []);
                                    setNewEditImages([]);
                                    setNewEditFiles([]);
                                    setNewEditImagePreviews([]);
                                    setNewEditFilePreviews([]);
                                    setEditLinkInput('');
                                    setShowEditLinkInput(false);
                                    setImagesToRemove([]);
                                    setFilesToRemove([]);
                                    setLinksToRemove([]);
                                    setEditPollQuestion(post.poll?.question || '');
                                    setEditPollOptions(post.poll?.options?.map(o => ({ id: o.id, text: o.text })) || []);
                                    setShowEditPollCreator(false);
                                    setNewEditPollQuestion('');
                                    setNewEditPollOptions(['', '']);
                                    setMenuOpenPostId(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-right text-sm text-[#3F3F46] rounded-lg hover:bg-[#F4F4F5] flex items-center gap-3 transition"
                                >
                                  <EditIcon className="w-3.5 h-3.5" />
                                  עריכה
                                </button>
                              )}
                              {/* Delete - for author or owner/manager */}
                              {(userId === post.author?.id || isOwner || isManager) && (
                                <button
                                  onClick={() => {
                                    setDeletePostModalId(post.id);
                                    setMenuOpenPostId(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-right text-sm text-[#B3261E] rounded-lg hover:bg-[#F4F4F5] flex items-center gap-3 transition"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                  מחיקה
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Post Content - Editable or Display */}
                    {editingPostId === post.id ? (
                      <div className="mb-4">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="כותרת (אופציונלי)"
                          className="w-full p-3 mb-2 border border-gray-200 rounded-lg text-right font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg text-right resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                          rows={4}
                        />
                        
                        {/* Attachments in Edit Mode - Full editing */}
                        <div className="mt-3 space-y-3">
                          {/* Existing Images */}
                          {editImages.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2">תמונות קיימות:</p>
                              <div className="flex flex-wrap gap-2">
                                {editImages.map((image, index) => (
                                  <div key={index} className={`relative ${imagesToRemove.includes(image) ? 'opacity-50' : ''}`}>
                                    <img
                                      src={getImageUrl(image)}
                                      alt={`תמונה ${index + 1}`}
                                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                    />
                                    {imagesToRemove.includes(image) ? (
                                      <button
                                        onClick={() => undoRemoveImage(image)}
                                        className="absolute -top-2 -right-2 bg-gray-500 text-white rounded-full p-1 text-xs"
                                        title="בטל הסרה"
                                      >
                                        ↩
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setImagesToRemove(prev => [...prev, image])}
                                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#B3261E] flex items-center justify-center"
                                      >
                                        <CloseIcon className="w-2.5 h-2.5 text-white" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Existing Files */}
                          {editFiles.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2">קבצים קיימים:</p>
                              <div className="flex flex-wrap gap-2">
                                {editFiles.map((file, index) => (
                                  <div key={index} className={`flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1 border border-gray-200 ${filesToRemove.includes(file.url) ? 'opacity-50 line-through' : ''}`}>
                                    <FileTextIcon size={16} color="#6B7280" />
                                    <span className="text-xs text-gray-700 max-w-[100px] truncate">{file.name}</span>
                                    {filesToRemove.includes(file.url) ? (
                                      <button
                                        onClick={() => undoRemoveFile(file.url)}
                                        className="text-gray-500 hover:text-gray-700 text-xs"
                                      >
                                        ↩
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setFilesToRemove(prev => [...prev, file.url])}
                                        className="text-red-500 hover:text-red-600"
                                      >
                                        <CloseIcon size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Existing Links */}
                          {editLinks.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2">קישורים:</p>
                              <div className="flex flex-wrap gap-2">
                                {editLinks.map((link, index) => (
                                  <div key={index} className={`flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1 border border-gray-200 ${linksToRemove.includes(link) ? 'opacity-50 line-through' : ''}`}>
                                    <LinkIcon size={12} color="#6B7280" />
                                    <span className="text-xs text-gray-700 max-w-[150px] truncate">{link}</span>
                                    {linksToRemove.includes(link) ? (
                                      <button
                                        onClick={() => undoRemoveEditLink(link)}
                                        className="text-gray-500 hover:text-gray-700 text-xs"
                                      >
                                        ↩
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => removeEditLink(link)}
                                        className="text-red-500 hover:text-red-600"
                                      >
                                        <CloseIcon size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          
                          {/* Poll Display in Edit Mode */}
                          {post.poll && (
                            <div className={`mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 ${pollToRemove ? 'opacity-50' : ''}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500 flex-shrink-0">
                                    <rect x="3" y="18" width="14" height="1.25" rx="0.5" fill="currentColor"/>
                                    <rect x="4.75" y="5" width="3" height="12" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                    <rect x="8.5" y="1" width="3" height="16" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                    <rect x="12.25" y="8" width="3" height="9" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                  </svg>
                                  {pollToRemove ? (
                                    <span className="flex-1 px-3 py-2 text-right font-medium text-gray-400 line-through">{editPollQuestion}</span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={editPollQuestion}
                                      onChange={(e) => setEditPollQuestion(e.target.value)}
                                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-right font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white"
                                      placeholder="שאלת הסקר"
                                    />
                                  )}
                                </div>
                                {pollToRemove ? (
                                  <button
                                    onClick={() => setPollToRemove(false)}
                                    className="text-gray-500 hover:text-gray-700 p-1 mr-2"
                                    title="בטל מחיקה"
                                  >
                                    ↩
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setPollToRemove(true)}
                                    className="text-gray-400 hover:text-red-500 transition p-1 mr-2"
                                    title="מחק סקר"
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </div>
                              {!pollToRemove && (
                                <>
                                  <div className="space-y-2">
                                    {editPollOptions.map((option, index) => (
                                      <div key={option.id} className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={option.text}
                                          onChange={(e) => {
                                            const newOptions = [...editPollOptions];
                                            newOptions[index] = { ...newOptions[index], text: e.target.value };
                                            setEditPollOptions(newOptions);
                                          }}
                                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white"
                                          placeholder={`אפשרות ${index + 1}`}
                                        />
                                        <span className="text-xs text-gray-400 w-16 text-left">
                                          {post.poll?.options.find(o => o.id === option.id)?.votes || 0} הצבעות
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-3 text-center">
                                    {post.poll.totalVotes === 1 ? 'הצבעה' : 'הצבעות'} {post.poll.totalVotes}
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 mt-3 justify-end">
                          <button
                            onClick={resetEditState}
                            disabled={editSubmitting}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                          >
                            ביטול
                          </button>
                          <button
                            onClick={() => handleEditPost(post.id)}
                            disabled={editSubmitting || !editContent.trim()}
                            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {editSubmitting ? '...' : 'שמור'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4">
                        {post.title && (
                          <h3 className="text-lg font-bold text-black mb-2">{post.title}</h3>
                        )}
                        <p className="text-black leading-relaxed whitespace-pre-wrap">{post.content}</p>
                        
                        {/* Poll Display */}
                        {post.poll && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-2 mb-3">
                              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500">
                                <rect x="3" y="18" width="14" height="1.25" rx="0.5" fill="currentColor"/>
                                <rect x="4.75" y="5" width="3" height="12" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                <rect x="8.5" y="1" width="3" height="16" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                <rect x="12.25" y="8" width="3" height="9" rx="0.75" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                              </svg>
                              <h4 className="font-medium text-gray-900">{post.poll.question}</h4>
                            </div>
                            <div className="space-y-2">
                              {post.poll.options.map((option) => {
                                const isVoted = post.poll?.userVotedOptionId === option.id;
                                const hasVoted = !!post.poll?.userVotedOptionId;
                                const isVoting = votingPollId === post.poll?.id;
                                
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => post.poll && handleVotePoll(post.poll.id, option.id, post.id, post.poll.userVotedOptionId)}
                                    disabled={isVoting}
                                    className={`w-full relative overflow-hidden rounded-lg border transition text-right ${
                                      isVoted 
                                        ? 'border-[#A7EA7B] bg-[#F0FDF4]' 
                                        : 'border-gray-200 bg-white hover:border-[#A7EA7B] hover:bg-[#F0FDF4]'
                                    }`}
                                  >
                                    {/* Progress bar background */}
                                    <div 
                                      className={`absolute inset-y-0 right-0 transition-all duration-500 ${isVoted ? 'bg-[#DCFCE7]' : 'bg-gray-100'}`}
                                      style={{ width: `${option.percentage}%` }}
                                    />
                                    <div className="relative flex items-center justify-between px-4 py-3" dir="rtl">
                                      <div className="flex items-center gap-2">
                                        {isVoted && <CheckIcon size={12} color="#163300" />}
                                        <span className={`text-sm ${isVoted ? 'font-medium text-[#163300]' : 'text-gray-700'}`}>
                                          {option.text}
                                        </span>
                                      </div>
                                      <span className={`text-sm font-medium ${isVoted ? 'text-[#163300]' : 'text-gray-500'}`}>
                                        {option.votes} ({option.percentage}%)
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-500 mt-3 text-center">
                              {post.poll.totalVotes === 1 ? 'הצבעה' : 'הצבעות'} {post.poll.totalVotes}
                            </p>
                          </div>
                        )}
                        
                        {/* Files Display */}
                        {post.files && post.files.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {post.files.map((file, index) => (
                              <button
                                key={index}
                                onClick={() => handleDownload(
                                  getImageUrl(file.url),
                                  file.name || 'file'
                                )}
                                className="w-full flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 hover:bg-gray-100 transition text-right"
                              >
                                <FileTextIcon size={24} color="#6B7280" />
                                <span className="flex-1 text-sm text-gray-700">{file.name || 'קובץ מצורף'}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Links Display with Preview */}
                        {post.links && post.links.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {post.links.map((link, index) => {
                              const preview = linkPreviews[link];
                              const videoProvider = getVideoProvider(link);
                              
                              // Video links: render playable inline
                              if (videoProvider && videoProvider !== 'unknown') {
                                return (
                                  <div key={index}>
                                    <VideoPlayer url={link} />
                                    <a
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 mt-1 text-xs text-blue-500 hover:text-blue-600 transition"
                                    >
                                      <FaExternalLinkAlt className="w-2.5 h-2.5" />
                                      {(() => { try { return new URL(link).hostname; } catch { return link; } })()}
                                    </a>
                                  </div>
                                );
                              }

                              // Regular links: show OG preview card
                              return (
                                <a
                                  key={index}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition"
                                >
                                  {preview?.image && (
                                    <div className="w-full h-40 bg-gray-100">
                                      <img 
                                        src={preview.image} 
                                        alt={preview.title || link}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div className="p-3">
                                    <div className="flex items-start gap-2">
                                      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0">
                                        <path d="M8.33325 10.834C8.69113 11.3124 9.14772 11.7083 9.67204 11.9947C10.1964 12.2812 10.7762 12.4516 11.3721 12.4942C11.9681 12.5369 12.5662 12.4509 13.126 12.2421C13.6858 12.0333 14.1942 11.7065 14.6166 11.284L17.1166 8.78396C17.8756 7.99811 18.2956 6.9456 18.2861 5.85312C18.2766 4.76063 17.8384 3.71558 17.0658 2.94304C16.2933 2.17051 15.2482 1.73231 14.1558 1.72281C13.0633 1.71332 12.0108 2.1333 11.2249 2.89229L9.79159 4.31729" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M11.6666 9.16702C11.3087 8.68858 10.8521 8.2927 10.3278 8.00623C9.80347 7.71977 9.22367 7.54942 8.62771 7.50674C8.03176 7.46406 7.4336 7.55004 6.8738 7.75887C6.314 7.96769 5.80566 8.29446 5.38326 8.71702L2.88326 11.217C2.12426 12.0029 1.70429 13.0554 1.71378 14.1479C1.72327 15.2403 2.16148 16.2854 2.93401 17.0579C3.70655 17.8305 4.7516 18.2687 5.84408 18.2782C6.93657 18.2877 7.98908 17.8677 8.77492 17.1087L10.1999 15.6837" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      <div className="flex-1 min-w-0">
                                        {preview?.title ? (
                                          <>
                                            <p className="font-medium text-gray-900 text-sm truncate">{preview.title}</p>
                                            {preview.description && (
                                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{preview.description}</p>
                                            )}
                                            <p className="text-xs text-blue-500 mt-1 truncate">{(() => { try { return new URL(link).hostname; } catch { return link; } })()}</p>
                                          </>
                                        ) : (
                                          <p className="text-sm text-blue-600 truncate">{link}</p>
                                        )}
                                      </div>
                                      <FaExternalLinkAlt className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                    </div>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Images Display - Dynamic sizing based on count */}
                        {post.images && post.images.length > 0 && (
                          <div className={`mt-3 grid gap-2 ${
                            post.images.length === 1 ? 'grid-cols-1' : 
                            post.images.length === 2 ? 'grid-cols-2' : 
                            post.images.length === 3 ? 'grid-cols-3' :
                            post.images.length === 4 ? 'grid-cols-2' :
                            'grid-cols-3'
                          }`}>
                            {post.images.slice(0, 6).map((image, index) => (
                              <div 
                                key={index} 
                                className={`relative ${
                                  post.images!.length === 1 ? '' : 
                                  post.images!.length === 3 && index === 0 ? 'col-span-3' :
                                  ''
                                }`}
                              >
                                <img
                                  src={getImageUrl(image)}
                                  alt={`תמונה ${index + 1}`}
                                  className={`w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition ${
                                    post.images!.length === 1 ? 'max-h-[500px]' :
                                    post.images!.length === 2 ? 'h-64' :
                                    post.images!.length === 3 && index === 0 ? 'h-64' :
                                    post.images!.length === 3 ? 'h-40' :
                                    post.images!.length === 4 ? 'h-48' :
                                    'h-40'
                                  }`}
                                  onClick={() => openLightbox(post.images!, index)}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Videos Display */}
                        {post.videos && post.videos.length > 0 && (
                          <div className="mt-3 space-y-3">
                            {post.videos.map((videoUrl, index) => (
                              <VideoPlayer key={index} url={getImageUrl(videoUrl)} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Like & Comment Buttons */}
                    <div className="flex items-center gap-2 text-sm mt-2">
                      <button
                        onClick={() => handleToggleLike(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${
                          post.isLiked 
                            ? 'text-[#163300] bg-[#A7EA7B] border-[#A7EA7B] hover:bg-[#96D96C]' 
                            : 'text-[#3F3F46] bg-[#F4F4F5] border-[#E4E4E7] hover:bg-[#E4E4E7]'
                        }`}
                      >
                        {post.isLiked ? <HeartFilledIcon className="w-4 h-4" /> : <HeartIcon className="w-4 h-4" />}
                        <span className="font-normal">{post._count?.likes || 0}</span>
                      </button>
                      <button
                        onClick={() => handleLoadComments(post.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#3F3F46] bg-[#F4F4F5] border border-[#E4E4E7] hover:bg-[#E4E4E7] transition"
                      >
                        <CommentIcon className="w-4 h-4" />
                        <span className="font-normal">{post._count?.comments || 0}</span>
                      </button>
                    </div>
                    
                    {/* Comments Section */}
                    {expandedComments[post.id] && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        {/* Comments List */}
                        {loadingComments[post.id] ? (
                          <p className="text-sm text-gray-400 text-center">טוען תגובות...</p>
                        ) : (
                          <div className="space-y-3 mb-4">
                            {postComments[post.id]?.length > 0 ? (
                              postComments[post.id].map((comment) => (
                                <div key={comment.id} className="flex gap-2 items-start group" dir="rtl">
                                  <Link href={`/profile/${comment.user?.id}`} className="flex-shrink-0">
                                    {comment.user?.profileImage ? (
                                      <img 
                                        src={getImageUrl(comment.user.profileImage)} 
                                        alt={comment.user.name}
                                        className="w-8 h-8 rounded-full object-cover hover:opacity-80 transition"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-xs font-bold text-pink-600 hover:opacity-80 transition">
                                        {comment.user?.name?.charAt(0) || '?'}
                                      </div>
                                    )}
                                  </Link>
                                  <div className="flex-1 bg-[#F4F4F5] rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <Link href={`/profile/${comment.user?.id}`} className="font-medium text-sm text-black hover:underline">
                                        {comment.user?.name || 'משתמש'}
                                      </Link>
                                      <span className="text-xs text-[#52525B] font-normal">
                                        {(() => {
                                          const now = new Date();
                                          const commentDate = new Date(comment.createdAt);
                                          const diffMs = now.getTime() - commentDate.getTime();
                                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                          const diffMinutes = Math.floor(diffMs / (1000 * 60));
                                          
                                          if (diffMinutes < 1) return 'עכשיו';
                                          if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
                                          if (diffHours < 24) {
                                            if (diffHours === 1) return 'לפני שעה';
                                            if (diffHours === 2) return 'לפני שעתיים';
                                            return `לפני ${diffHours} שעות`;
                                          }
                                          return commentDate.toLocaleDateString('he-IL');
                                        })()}
                                      </span>
                                    </div>
                                    {editingCommentId === comment.id ? (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={editCommentContent}
                                          onChange={(e) => setEditCommentContent(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && editCommentContent.trim()) {
                                              handleEditComment(comment.id, post.id);
                                            } else if (e.key === 'Escape') {
                                              setEditingCommentId(null);
                                              setEditCommentContent('');
                                            }
                                          }}
                                          className="flex-1 px-2 py-1 border border-gray-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black bg-white"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleEditComment(comment.id, post.id)}
                                          className="text-green-500 hover:text-green-600 p-1"
                                          title="שמור"
                                        >
                                          <CheckIcon size={12} />
                                        </button>
                                        <button
                                          onClick={() => { setEditingCommentId(null); setEditCommentContent(''); }}
                                          className="text-gray-400 hover:text-gray-600 p-1"
                                          title="בטל"
                                        >
                                          <CloseIcon size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-black text-right">{comment.content}</p>
                                    )}
                                  </div>
                                  {/* 3 dots menu - only visible on hover */}
                                  <div className="w-6 flex-shrink-0">
                                    {userId === comment.user?.id && editingCommentId !== comment.id && (
                                      <div className="relative opacity-0 group-hover:opacity-100 transition-opacity" dir="ltr">
                                        <button
                                          onClick={() => setCommentMenuOpenId(commentMenuOpenId === comment.id ? null : comment.id)}
                                          className="p-1 text-[#52525B] rounded-full hover:bg-gray-100 transition"
                                        >
                                          <MoreDotsIcon className="w-4 h-4" />
                                        </button>
                                        {commentMenuOpenId === comment.id && (
                                          <>
                                            <div 
                                              className="fixed inset-0 z-10"
                                              onClick={() => setCommentMenuOpenId(null)}
                                            />
                                            <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E4E4E7] p-1 z-20 min-w-[120px]" dir="rtl">
                                              <button
                                                onClick={() => { 
                                                  setEditingCommentId(comment.id); 
                                                  setEditCommentContent(comment.content);
                                                  setCommentMenuOpenId(null);
                                                }}
                                                className="w-full px-3 py-2.5 text-right text-sm text-[#3F3F46] rounded-lg hover:bg-[#F4F4F5] flex items-center gap-3 transition"
                                              >
                                                <EditIcon className="w-3.5 h-3.5" />
                                                עריכה
                                              </button>
                                              <button
                                                onClick={() => {
                                                  handleDeleteComment(comment.id, post.id);
                                                  setCommentMenuOpenId(null);
                                                }}
                                                className="w-full px-3 py-2.5 text-right text-sm text-[#B3261E] rounded-lg hover:bg-[#F4F4F5] flex items-center gap-3 transition"
                                              >
                                                <TrashIcon className="w-4 h-4" />
                                                מחיקה
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-400 text-center">אין תגובות עדיין</p>
                            )}
                          </div>
                        )}
                        
                        {/* Add Comment Input */}
                        {userEmail && (
                          <div className="relative flex gap-2 items-center">
                            {userProfile?.profileImage ? (
                              <img 
                                src={getImageUrl(userProfile.profileImage)}
                                alt={userProfile.name || 'User'}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-xs font-bold text-pink-600 flex-shrink-0">
                                {userProfile?.name?.charAt(0) || userEmail?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={newCommentContent[post.id] || ''}
                                onChange={(e) => handleCommentInputChange(post.id, e.target.value, e.target.selectionStart || 0)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setShowMentionDropdown(null);
                                    setMentionSuggestions([]);
                                  } else if (e.key === 'Enter' && !showMentionDropdown && newCommentContent[post.id]?.trim() && !submittingComment[post.id]) {
                                    handleAddComment(post.id);
                                  }
                                }}
                                onBlur={() => {
                                  // Delay hiding to allow click on suggestion
                                  setTimeout(() => setShowMentionDropdown(null), 200);
                                }}
                                disabled={submittingComment[post.id]}
                                placeholder="כתבו תגובה..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-right text-sm focus:outline-none focus:border-black disabled:opacity-50"
                              />
                              {/* Mention Autocomplete Dropdown */}
                              {showMentionDropdown === post.id && mentionSuggestions.length > 0 && (
                                <div className="absolute bottom-full right-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                  {mentionSuggestions.map((user) => (
                                    <button
                                      key={user.id}
                                      type="button"
                                      onClick={() => insertMention(post.id, user.name)}
                                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 text-right"
                                    >
                                      {user.profileImage ? (
                                        <img 
                                          src={getImageUrl(user.profileImage)}
                                          alt={user.name}
                                          className="w-6 h-6 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600">
                                          {user.name?.charAt(0)}
                                        </div>
                                      )}
                                      <span className="text-sm text-gray-800">{user.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleAddComment(post.id)}
                              disabled={!newCommentContent[post.id]?.trim() || submittingComment[post.id]}
                              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:opacity-90 disabled:bg-[#A1A1AA] disabled:text-[#71717A] disabled:cursor-not-allowed"
                            >
                              {submittingComment[post.id] ? '...' : 'שלח'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
                  {searchQuery.trim() ? (
                    <div className="space-y-2">
                      <SearchXIcon className="w-16 h-16 mx-auto" />
                      <p className="text-black text-lg">לא נמצאו תוצאות עבור "{searchQuery}"</p>
                    </div>
                  ) : showSavedOnly ? (
                    <div className="space-y-2">
                      <svg 
                        viewBox="0 0 40 40" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10 mx-auto text-gray-800"
                      >
                        <rect width="40" height="40" rx="20" fill="#F4F4F5"/>
                        <path 
                          d="M25.8332 27.5L19.9998 24.1667L14.1665 27.5V14.1667C14.1665 13.7246 14.3421 13.3007 14.6547 12.9882C14.9672 12.6756 15.3911 12.5 15.8332 12.5H24.1665C24.6085 12.5 25.0325 12.6756 25.345 12.9882C25.6576 13.3007 25.8332 13.7246 25.8332 14.1667V27.5Z" 
                          stroke="currentColor" 
                          strokeWidth="1.25" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p className="font-normal text-gray-800" style={{ fontSize: '18px' }}>עדיין אין לכם פוסטים שמורים</p>
                      <p className="font-normal text-gray-800" style={{ fontSize: '18px' }}>לחצו על סימן השמירה בפוסט כדי לשמור אותו</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <svg 
                        viewBox="0 0 40 40" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-10 h-10 mx-auto"
                      >
                        <rect width="40" height="40" rx="20" fill="#F4F4F5"/>
                        <path 
                          d="M25 15L15 25" 
                          stroke="#3F3F46" 
                          strokeWidth="1.25" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                        <path 
                          d="M15 15L25 25" 
                          stroke="#3F3F46" 
                          strokeWidth="1.25" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p className="text-gray-800" style={{ fontSize: '16px' }}>עדיין אין פוסטים בקהילה זו</p>
                    </div>
                  )}
                </div>
              );
            })()}
            </div>
          </div>

          {/* RIGHT: Sidebar with online members, rules, events, top members */}
          <div className="space-y-4">
            {/* Online Members */}
            {community?.showOnlineMembers !== false && (
            <div className="bg-gray-100 border border-gray-400 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-[#A7EA7B] rounded-full"></div>
                  <div className="w-3 h-3 bg-[#A7EA7B] rounded-full absolute top-0 left-0 animate-ping opacity-75"></div>
                </div>
                <span style={{ fontSize: '16px' }} className="text-gray-600 font-normal">
                  <span className="font-semibold text-black">{onlineCount}</span> חברים מחוברים עכשיו
                </span>
              </div>
            </div>
            )}

            {/* כללי הקהילה */}
            <div className="bg-gray-100 border border-gray-400 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheckIcon className="w-4 h-4 flex-shrink-0 text-black" />
                <h3 style={{ fontSize: '18px' }} className="font-semibold text-black">כללי הקהילה</h3>
              </div>
              {community?.rules && community.rules.length > 0 ? (
                <>
                  <ul className="space-y-2">
                    {community.rules.slice(0, 3).map((rule, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-800" />
                        <span style={{ fontSize: '16px' }} className="text-gray-600 font-normal">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : userId ? (
                <p style={{ fontSize: '16px' }} className="text-gray-800 text-center py-2">
                  {(isOwner || isManager) ? (
                    <Link href={`/communities/${communityId}/manage?tab=rules`} className="text-gray-800 underline hover:opacity-80">
                      הוסיפו כללים לקהילה
                    </Link>
                  ) : (
                    <span className="underline">לא הוגדרו כללים לקהילה זו</span>
                  )}
                </p>
              ) : null}
            </div>

            {/* אירועים קרובים */}
            <div className="bg-gray-100 border border-gray-400 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-4 h-4 flex-shrink-0 text-black" />
                <h3 style={{ fontSize: '18px' }} className="font-semibold text-black">אירועים קרובים</h3>
              </div>
              {upcomingEvents.length > 0 ? (
                <div style={{ gap: '12px' }} className="flex flex-col">
                  {upcomingEvents.map(event => {
                    const eventDate = new Date(event.date);
                    const formatEventTime = eventDate.toLocaleTimeString('he-IL', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                    const dayName = eventDate.toLocaleDateString('he-IL', { weekday: 'long' });
                    const dayNum = eventDate.getDate();
                    const monthName = eventDate.toLocaleDateString('he-IL', { month: 'long' });
                    
                    return (
                      <Link
                        key={event.id}
                        href={`/communities/${communityId}/events`}
                        className="block hover:opacity-80 transition"
                      >
                        <p style={{ fontSize: '16px' }} className="font-semibold text-black truncate">{event.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p style={{ fontSize: '16px' }} className="text-gray-500 font-normal whitespace-nowrap">
                            {dayNum} ב{monthName} · {dayName} · {formatEventTime}
                          </p>
                          {event._count?.rsvps ? (
                            <div className="flex items-center gap-1.5 text-gray-800 flex-shrink-0 mr-3">
                              <UsersIcon className="w-3.5 h-3.5" />
                              <span style={{ fontSize: '12px' }} className="font-normal">{event._count.rsvps} אישרו הגעה</span>
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '16px' }} className="text-gray-800 text-center py-2">אין אירועים קרובים</p>
              )}
            </div>

            {/* חברי קהילה מובילים */}
            <div className="bg-gray-100 border border-gray-400 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrophyIcon className="w-4 h-4 flex-shrink-0 text-black" />
                <h3 style={{ fontSize: '18px' }} className="font-semibold text-black">חברי קהילה מובילים</h3>
              </div>
              <div className="space-y-4">
                {topMembers.length > 0 ? (
                  topMembers.map((member) => {
                    const getRankIcon = (rank: number) => {
                      switch (rank) {
                        case 1:
                          return <TrophyIcon className="w-5 h-5 text-[#FFD700]" />;
                        case 2:
                          return <AwardIcon className="w-5 h-5 text-[#A8A8A8]" />;
                        case 3:
                          return <AwardIcon className="w-5 h-5 text-[#CD7F32]" />;
                        default:
                          return <span style={{ fontSize: '14px' }} className="text-gray-500 font-bold">{rank}</span>;
                      }
                    };
                    return (
                      <div key={member.userId} className="flex items-center gap-3">
                        {/* Rank medal */}
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                          {getRankIcon(member.rank)}
                        </div>
                        {/* Profile picture */}
                        <Link href={`/profile/${member.userId}`} className="flex-shrink-0">
                          {member.profileImage ? (
                            <img
                              src={getImageUrl(member.profileImage)}
                              alt={member.name}
                              className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold text-gray-600 hover:opacity-80 transition" style={{ fontSize: '14px' }}>
                              {member.name?.charAt(0) || '?'}
                            </div>
                          )}
                        </Link>
                        {/* Name */}
                        <Link href={`/profile/${member.userId}`} style={{ fontSize: '16px' }} className="font-normal text-black flex-1 hover:underline">
                          {member.name}
                        </Link>
                        {/* Score */}
                        <span style={{ fontSize: '16px' }} className="text-black font-bold">{member.points}</span>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ fontSize: '14px' }} className="text-gray-800 text-center py-2">אין נתונים עדיין</p>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>
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

      {/* Delete Post Confirmation Modal */}
      {deletePostModalId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          onClick={() => setDeletePostModalId(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <TrashCircleIcon className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-bold text-black mb-2">מחיקת פוסט</h3>
              <p className="text-[#3F3F46] mb-1">האם אתם בטוחים שברצונכם למחוק את הפוסט?</p>
              <p className="text-[#3F3F46] mb-6">פעולה זו לא ניתנת לביטול.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletePostModalId(null)}
                  className="flex-1 px-4 py-2.5 border border-black rounded-xl text-black font-medium hover:bg-gray-50 transition"
                >
                  ביטול
                </button>
                <button
                  onClick={() => handleDeletePost(deletePostModalId)}
                  className="flex-1 px-4 py-2.5 bg-[#B3261E] text-white rounded-xl font-medium hover:opacity-90 transition"
                >
                  מחיקה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CommunityFeedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">טוען...</div>}>
      <CommunityFeedContent />
    </Suspense>
  );
}
