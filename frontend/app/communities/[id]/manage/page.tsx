'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaYoutube, FaWhatsapp, FaFacebook, FaInstagram } from 'react-icons/fa';
import { compressImage, compressImages, MAX_IMAGE_SIZE_BYTES } from '../../../lib/imageCompression';
import { isValidVideoUrl, getVideoProvider, getProviderLabel, MAX_VIDEO_SIZE_BYTES } from '../../../lib/videoUtils';
import { useCommunityContext } from '../CommunityContext';
import { VideoThumbnail } from '../../../components/VideoPlayer';
import FormSelect from '../../../components/FormSelect';
import PlusIcon from '../../../components/icons/PlusIcon';
import TrashIcon from '../../../components/icons/TrashIcon';
import CheckIcon from '../../../components/icons/CheckIcon';
import CloseIcon from '../../../components/icons/CloseIcon';
import NoFeeIcon from '../../../components/icons/NoFeeIcon';
import DollarIcon from '../../../components/icons/DollarIcon';
import CalendarIcon from '../../../components/icons/CalendarIcon';
import ImageIcon from '../../../components/icons/ImageIcon';
import VideoIcon from '../../../components/icons/VideoIcon';
import LockIcon from '../../../components/icons/LockIcon';
import SettingsIcon from '../../../components/icons/SettingsIcon';
import CreditCardIcon from '../../../components/icons/CreditCardIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

interface Community {
  id: string;
  name: string;
  slug: string | null;
  description: string;
  topic: string | null;
  image: string | null;
  logo: string | null;
  ownerId: string;
  memberCount: number;
  youtubeUrl: string | null;
  whatsappUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  galleryImages: string[];
  galleryVideos: string[];
  rules: string[];
  trialStartDate: string | null;
  trialCancelled: boolean;
  cardLastFour: string | null;
  cardBrand: string | null;
}

interface ImageFile {
  file?: File;
  preview: string;
  isPrimary: boolean;
  isExisting: boolean;
  existingPath?: string;
}

type TabType = 'general' | 'rules' | 'social' | 'payments';

export default function ManageCommunityPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const communityId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [community, setCommunity] = useState<Community | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Get user data from layout context
  const { userEmail, userId, userProfile, isOwner } = useCommunityContext();
  
  // Slug
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugSuccess, setSlugSuccess] = useState('');
  const [slugLoading, setSlugLoading] = useState(false);
  
  // Social links
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  
  // Logo
  const [logo, setLogo] = useState<{ file?: File; preview: string; isExisting: boolean; existingPath?: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  
  // Images
  const [images, setImages] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Community Rules
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  
  // Gallery Videos (YouTube/Vimeo/Dailymotion URLs + uploaded MP4s)
  const [galleryVideos, setGalleryVideos] = useState<string[]>([]);
  const [galleryVideoFiles, setGalleryVideoFiles] = useState<File[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  
  // Online members indicator
  const [showOnlineMembers, setShowOnlineMembers] = useState(true);
  
  // Price
  const [price, setPrice] = useState<number>(10);
  const [isPaidCommunity, setIsPaidCommunity] = useState(false);
  
  // Trial and payment
  const [trialStartDate, setTrialStartDate] = useState<Date | null>(null);
  const [trialCancelled, setTrialCancelled] = useState(false);
  const [cardLastFour, setCardLastFour] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showCancelTrialModal, setShowCancelTrialModal] = useState(false);
  const [cancellingTrial, setCancellingTrial] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCvv, setNewCardCvv] = useState('');

  // Categories - synced with COMMUNITY_TOPICS from home page
  const categories = [
    'בחר קטגוריה',
    'אנימציה',
    'אוכל, בישול ותזונה',
    'עזרה ותמיכה',
    'עיצוב גרפי',
    'עיצוב מותגים',
    'עריכת וידאו',
    'בריאות הנפש ופיתוח אישי',
    'גיימינג',
    'טיולים ולייפסטייל',
    'לימודים ואקדמיה',
    'מדיה, קולנוע וסדרות',
    'מדיה חברתית ותוכן ויזואלי',
    'ניהול פיננסי והשקעות',
    'ספרים וכתיבה',
    'ספורט ואורח חיים פעיל',
    'תחביבים',
    'יזמות ועסקים עצמאיים'
  ];

  // Track initial form values to detect unsaved changes
  const initialFormRef = useRef<{ name: string; description: string; topic: string; slug: string; rules: string[]; youtubeUrl: string; whatsappUrl: string; facebookUrl: string; instagramUrl: string; price: number; isPaidCommunity: boolean; showOnlineMembers: boolean } | null>(null);

  const hasUnsavedChanges = () => {
    const init = initialFormRef.current;
    if (!init) return false;
    return (
      name !== init.name ||
      description !== init.description ||
      topic !== init.topic ||
      slug !== init.slug ||
      JSON.stringify(rules) !== JSON.stringify(init.rules) ||
      youtubeUrl !== init.youtubeUrl ||
      whatsappUrl !== init.whatsappUrl ||
      facebookUrl !== init.facebookUrl ||
      instagramUrl !== init.instagramUrl ||
      price !== init.price ||
      isPaidCommunity !== init.isPaidCommunity ||
      showOnlineMembers !== init.showOnlineMembers ||
      images.some(img => !img.isExisting) ||
      galleryVideoFiles.length > 0 ||
      !!(logo && !logo.isExisting)
    );
  };

  // Keep a ref in sync so stable closures can read latest value
  const shouldBlockRef = useRef(false);
  useEffect(() => {
    shouldBlockRef.current = hasUnsavedChanges();
  });

  useEffect(() => {
    setMounted(true);
    const tab = searchParams.get('tab');
    if (tab === 'rules' || tab === 'social' || tab === 'payments') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Warn user about unsaved changes when leaving (browser close/refresh + client-side navigation)
  useEffect(() => {
    // Browser close / refresh
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldBlockRef.current) {
        e.preventDefault();
      }
    };

    // Intercept clicks on links (catches Next.js <Link> before router processes them)
    const onLinkClick = (e: MouseEvent) => {
      if (!shouldBlockRef.current) return;
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      // Only block same-origin navigation
      if (anchor.origin !== window.location.origin) return;
      // Don't block same-page anchors
      if (anchor.pathname === window.location.pathname && anchor.hash) return;
      const confirmed = window.confirm('\u05d9\u05e9\u05e0\u05dd \u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05dc\u05d0 \u05e9\u05de\u05d5\u05e8\u05d9\u05dd. \u05d4\u05d0\u05dd \u05d0\u05ea\u05d4 \u05d1\u05d8\u05d5\u05d7 \u05e9\u05d1\u05e8\u05e6\u05d5\u05e0\u05da \u05dc\u05e2\u05d6\u05d5\u05d1?');
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        shouldBlockRef.current = false;
        initialFormRef.current = null;
      }
    };

    // Intercept back/forward button
    const onPopState = () => {
      if (shouldBlockRef.current) {
        const confirmed = window.confirm('\u05d9\u05e9\u05e0\u05dd \u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05dc\u05d0 \u05e9\u05de\u05d5\u05e8\u05d9\u05dd. \u05d4\u05d0\u05dd \u05d0\u05ea\u05d4 \u05d1\u05d8\u05d5\u05d7 \u05e9\u05d1\u05e8\u05e6\u05d5\u05e0\u05da \u05dc\u05e2\u05d6\u05d5\u05d1?');
        if (!confirmed) {
          history.go(1);
        }
      }
    };

    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('click', onLinkClick, true);
    };
  }, []);

  // Auto-dismiss messages after 5 seconds and scroll to message
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      if (messageRef.current) {
        messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Fetch community details and check permissions
  useEffect(() => {
    const fetchCommunity = async () => {
      if (!communityId || !userId) return;
      
      const token = localStorage.getItem('token');
      if (!token) return;
      
      try {
        // First check membership and permissions
        const membershipRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/membership`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (membershipRes.ok) {
          const membershipData = await membershipRes.json();
          
          // Only owners and managers can access manage page
          if (!membershipData.canEdit) {
            router.push(`/communities/${communityId}/feed`);
            return;
          }
        } else {
          router.push('/');
          return;
        }
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
        if (!res.ok) throw new Error('Community not found');
        
        const data = await res.json();
        
        // Redirect to slug URL if community has a slug and we're using ID
        if (data.slug && communityId !== data.slug) {
          router.replace(`/communities/${data.slug}/manage`);
          return;
        }
        
        setCommunity(data);
        setName(data.name);
        setDescription(data.description);
        setTopic(data.topic || '');
        setSlug(data.slug || '');
        setYoutubeUrl(data.youtubeUrl || '');
        setWhatsappUrl(data.whatsappUrl || '');
        setFacebookUrl(data.facebookUrl || '');
        setInstagramUrl(data.instagramUrl || '');
        setRules(data.rules || []);
        setPrice(data.price || 10);
        setIsPaidCommunity((data.price ?? 0) > 0);
        
        // Load trial and payment info
        if (data.trialStartDate) {
          setTrialStartDate(new Date(data.trialStartDate));
        } else {
          // If no trial start date, set it to community creation date (or now)
          setTrialStartDate(data.createdAt ? new Date(data.createdAt) : new Date());
        }
        setTrialCancelled(data.trialCancelled || false);
        setCardLastFour(data.cardLastFour || null);
        setCardBrand(data.cardBrand || null);
        setShowOnlineMembers(data.showOnlineMembers !== false);
        
        // Store initial form values for unsaved changes detection
        initialFormRef.current = {
          name: data.name,
          description: data.description,
          topic: data.topic || '',
          slug: data.slug || '',
          rules: data.rules || [],
          youtubeUrl: data.youtubeUrl || '',
          whatsappUrl: data.whatsappUrl || '',
          facebookUrl: data.facebookUrl || '',
          instagramUrl: data.instagramUrl || '',
          price: data.price || 10,
          isPaidCommunity: (data.price ?? 0) > 0,
          showOnlineMembers: data.showOnlineMembers !== false,
        };
        
        // Load logo
        if (data.logo) {
          setLogo({
            preview: getImageUrl(data.logo),
            isExisting: true,
            existingPath: data.logo,
          });
        }
        
        // Load images
        const loadedImages: ImageFile[] = [];
        
        // Primary image
        if (data.image) {
          loadedImages.push({
            preview: getImageUrl(data.image),
            isPrimary: true,
            isExisting: true,
            existingPath: data.image,
          });
        }
        
        // Gallery images
        if (data.galleryImages && Array.isArray(data.galleryImages)) {
          data.galleryImages.forEach((path: string) => {
            loadedImages.push({
              preview: getImageUrl(path),
              isPrimary: false,
              isExisting: true,
              existingPath: path,
            });
          });
        }
        
        setImages(loadedImages);
        
        // Load gallery videos
        if (data.galleryVideos && Array.isArray(data.galleryVideos)) {
          setGalleryVideos(data.galleryVideos);
        }
      } catch (err) {
        console.error('Error fetching community:', err);
        router.push('/');
      } finally {
        setPageLoading(false);
      }
    };

    fetchCommunity();
  }, [communityId, userId, router]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setMessage('ניתן להעלות רק קבצי תמונה');
      setMessageType('error');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setMessage('גודל התמונה חורג מ-20MB');
      setMessageType('error');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }
    
    // Compress logo before setting
    const compressedFile = await compressImage(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo({ file: compressedFile, preview: reader.result as string, isExisting: false });
    };
    reader.readAsDataURL(compressedFile);
    
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    // Filter to only image files
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length < files.length) {
      setMessage('חלק מהקבצים לא נתמכים. ניתן להעלות רק תמונות');
      setMessageType('error');
    }

    // Filter out oversized files
    const oversized = imageFiles.filter(f => f.size > MAX_IMAGE_SIZE_BYTES);
    const validFiles = imageFiles.filter(f => f.size <= MAX_IMAGE_SIZE_BYTES);
    if (oversized.length > 0) {
      setMessage('חלק מהתמונות חורגות מ-20MB');
      setMessageType('error');
    }
    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Limit total media (images + videos) to 10
    const totalMedia = images.length + galleryVideos.length + galleryVideoFiles.length;
    const maxAllowed = 10 - totalMedia;
    if (maxAllowed <= 0) {
      setMessage('אפשר להעלות עד 10 תמונות/סרטונים');
      setMessageType('error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // Take only as many as allowed
    const filesToProcess = validFiles.slice(0, maxAllowed);
    
    // Compress all images
    const compressedFiles = await compressImages(filesToProcess);
    
    compressedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage: ImageFile = {
          file,
          preview: reader.result as string,
          isPrimary: images.length === 0, // First image is primary if no images exist
          isExisting: false,
        };
        setImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImageAtIndex = (index: number) => {
    setImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // If we removed the primary, make first one primary
      if (prev[index].isPrimary && updated.length > 0) {
        updated[0].isPrimary = true;
      }
      return updated;
    });
  };

  const setPrimaryImage = (index: number) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    })));
  };

  const handleUpdateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim()) {
      setMessage('אנא מלאו את כל השדות החובה');
      setMessageType('error');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('topic', topic);
      
      // Logo
      if (logo) {
        if (logo.isExisting) {
          formData.append('existingLogo', logo.existingPath || '');
        } else if (logo.file) {
          formData.append('logo', logo.file);
        }
      } else {
        formData.append('removeLogo', 'true');
      }
      
      // Social links
      formData.append('youtubeUrl', youtubeUrl);
      formData.append('whatsappUrl', whatsappUrl);
      formData.append('facebookUrl', facebookUrl);
      formData.append('instagramUrl', instagramUrl);
      
      // Price
      formData.append('price', price.toString());
      
      // Find primary image
      const primaryImage = images.find(img => img.isPrimary);
      if (primaryImage) {
        if (primaryImage.isExisting) {
          // Keep existing primary image - send its path
          formData.append('existingPrimaryImage', primaryImage.existingPath || '');
        } else if (primaryImage.file) {
          // New primary image
          formData.append('image', primaryImage.file);
        }
      } else {
        // No primary image - remove it
        formData.append('removeImage', 'true');
      }
      
      // Gallery images (non-primary)
      const existingGalleryPaths = images
        .filter(img => !img.isPrimary && img.isExisting)
        .map(img => img.existingPath);
      formData.append('existingGalleryImages', JSON.stringify(existingGalleryPaths));
      
      // New gallery images
      images.filter(img => !img.isPrimary && !img.isExisting && img.file).forEach(img => {
        formData.append('galleryImages', img.file!);
      });
      
      // Gallery videos (external URLs)
      formData.append('existingGalleryVideos', JSON.stringify(galleryVideos));
      
      // Gallery video files (uploaded MP4s)
      galleryVideoFiles.forEach(file => {
        formData.append('galleryVideoFiles', file);
      });
      
      // Online members indicator
      formData.append('showOnlineMembers', showOnlineMembers.toString());

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update community');
      }

      // Also save rules
      const rulesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/rules`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rules }),
      });

      if (!rulesRes.ok) {
        console.error('Failed to save rules');
      }

      setMessage('הקהילה עודכנה בהצלחה!');
      setMessageType('success');
      initialFormRef.current = null; // Reset so beforeunload won't trigger
      setTimeout(() => {
        router.push(`/communities/${communityId}/about`);
      }, 3000);
    } catch (err: any) {
      console.error('Community update error:', err);
      setMessage(err.message || 'שגיאה בעדכון הקהילה');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Slug handlers
  const handleSlugChange = (value: string) => {
    // Only allow lowercase letters, numbers, and hyphens
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
    setSlugError('');
    setSlugSuccess('');
  };

  const handleUpdateSlug = async () => {
    if (!slug.trim()) {
      setSlugError('יש להזין כתובת URL');
      return;
    }

    if (slug.length < 3) {
      setSlugError('הכתובת חייבת להכיל לפחות 3 תווים');
      return;
    }

    if (slug.length > 50) {
      setSlugError('הכתובת יכולה להכיל עד 50 תווים');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setSlugError('יש להתחבר מחדש');
      return;
    }

    try {
      setSlugLoading(true);
      setSlugError('');
      setSlugSuccess('');

      // Check availability first
      const checkRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/check-slug/${slug}?excludeId=${communityId}`
      );
      const checkData = await checkRes.json();

      if (!checkData.available) {
        setSlugError('הכתובת הזו כבר תפוסה');
        return;
      }

      // Update slug
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/slug`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slug }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update slug');
      }

      setSlugSuccess('הכתובת עודכנה בהצלחה! מעביר...');
      
      // Redirect to new slug URL after short delay
      setTimeout(() => {
        router.push(`/communities/${slug}/manage`);
      }, 1000);
    } catch (err: any) {
      setSlugError(err.message || 'שגיאה בעדכון הכתובת');
    } finally {
      setSlugLoading(false);
    }
  };

  // Rules handlers
  const handleAddRule = () => {
    if (!newRule.trim()) return;
    if (newRule.trim().length > 50) return;
    if (rules.length >= 3) return; // Limit to 3 rules max
    setRules(prev => [...prev, newRule.trim()]);
    setNewRule('');
  };

  const handleRemoveRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteCommunity = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setDeleting(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete community');
      }

      router.push('/');
    } catch (err) {
      console.error('Delete error:', err);
      setMessage('שגיאה במחיקת הקהילה');
      setMessageType('error');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (pageLoading || !userEmail) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-100">
        <p className="text-gray-600">טוען...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-right" dir="rtl">
      {/* Main Layout with Sidebar */}
      <div className="flex min-h-[calc(100vh-65px)]">
        {/* Right Sidebar - Settings Tabs */}
        <aside className="w-64 bg-white border-l border-gray-200 p-6 flex-shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <SettingsIcon size={20} className="text-gray-600" />
            <h2 className="text-base font-semibold text-gray-900">הגדרות</h2>
          </div>
          
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`w-full text-right px-4 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'general'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              style={{ fontSize: '16px' }}
            >
              כללי
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`w-full text-right px-4 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'rules'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              style={{ fontSize: '16px' }}
            >
              כללי הקהילה
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('social')}
              className={`w-full text-right px-4 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'social'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              style={{ fontSize: '16px' }}
            >
              רשתות חברתיות
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('payments')}
                className={`w-full text-right px-4 py-2.5 rounded-lg font-medium transition ${
                  activeTab === 'payments'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                style={{ fontSize: '16px' }}
              >
                תשלומים
              </button>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <form onSubmit={handleUpdateCommunity} className="max-w-5xl">
            
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
                {/* Community Name */}
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">שם הקהילה</h3>
                    <p className="text-sm text-gray-500 mt-1">השם הכללי שיוצג ברחבי האתר</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="לדוגמא: יוגה למומחים"
                      className="w-full p-3.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right text-base"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                </div>

                {/* Community URL */}
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">לינק (URL)</h3>
                    <p className="text-sm text-gray-500 mt-1">הכתובת הציבורית של הקהילה (אותיות באנגלית, מספרים ומקפים בלבד)</p>
                  </div>
                  <div className="flex-1">
                    {/* Slug input */}
                    <div className="flex items-center gap-2" dir="ltr">
                      <div className="flex items-center flex-1 border border-gray-300 rounded-lg overflow-hidden">
                        <span className="px-4 py-3.5 bg-gray-50 text-gray-500 text-base border-r border-gray-300 whitespace-nowrap">withly.co.il/communities/</span>
                        <input
                          type="text"
                          placeholder="הזן כתובת מותאמת אישית"
                          className="flex-1 p-3.5 text-left text-gray-900 text-base bg-white focus:outline-none"
                          value={slug}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          maxLength={50}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleUpdateSlug}
                        disabled={slugLoading || !slug.trim() || slug === community?.slug}
                        className="px-4 py-3.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm whitespace-nowrap"
                      >
                        {slugLoading ? '...' : 'שמור'}
                      </button>
                    </div>
                    {slugError && (
                      <p className="text-sm text-red-500 mt-2" dir="rtl">{slugError}</p>
                    )}
                    {slugSuccess && (
                      <p className="text-sm text-green-600 mt-2" dir="rtl">{slugSuccess}</p>
                    )}
                  </div>
                </div>

                {/* Logo */}
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">לוגו / תמונת פרופיל</h3>
                    <p className="text-sm text-gray-500 mt-1">האייקון שמייצג את הקהילה</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                    {logo ? (
                      <img
                        src={logo.preview}
                        alt="לוגו הקהילה"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-32 h-32 border border-gray-200 rounded-lg flex items-center justify-center bg-white">
                        <ImageIcon size={40} color="#D1D5DB" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 border border-gray-300 cursor-pointer hover:bg-gray-50 transition text-base font-normal w-44"
                        style={{ borderRadius: '8px' }}
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>העלאת תמונת לוגו</span>
                      </label>
                      {logo && (
                        <button
                          type="button"
                          onClick={() => setLogo(null)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#B3261E] text-[#B3261E] hover:bg-red-50 transition text-base font-normal w-44"
                          style={{ borderRadius: '8px' }}
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span>מחק תמונה נוכחית</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                </div>

                {/* Category */}
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">קטגוריה</h3>
                    <p className="text-sm text-gray-500 mt-1">עוזר לאיתור וגילוי הקהילה</p>
                  </div>
                  <div className="flex-1">
                    <FormSelect
                      value={topic}
                      onChange={setTopic}
                      placeholder="בחר קטגוריה"
                      options={categories.filter(cat => cat !== 'בחר קטגוריה').map(cat => ({ value: cat, label: cat }))}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">תיאור הקהילה</h3>
                    <p className="text-sm text-gray-500 mt-1">פירוט על הקהילה, למי היא מתאימה, מטרותיה ותחומי העניין שעוסקים בה</p>
                  </div>
                  <div className="flex-1">
                    <textarea
                      placeholder="תארו את הקהילה, מה הם הנושאים המרכזיים, מי יכול להצטרף..."
                      className="w-full p-3.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right resize-none text-base"
                      rows={6}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      maxLength={1000}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {description.length}/1000 תווים
                    </p>
                  </div>
                </div>

                {/* Community Images */}
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">תמונות הקהילה</h3>
                    <p className="text-sm text-gray-500 mt-1">תמונות שיוצגו בעמוד הקהילה</p>
                  </div>
                  <div className="flex-1">
                  {images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {images.map((img, index) => (
                        <div key={index} className="relative group" style={{ width: '220px', height: '124px' }}>
                          <img
                            src={img.preview}
                            alt={`תמונה ${index + 1}`}
                            className={`w-full h-full object-cover ${
                              img.isPrimary ? '' : 'border border-gray-200'
                            }`}
                            style={img.isPrimary ? { border: '3px solid #A7EA7B', borderRadius: '12px' } : { borderRadius: '12px' }}
                          />
                          {img.isPrimary && (
                            <div 
                              className="absolute flex items-center justify-center font-medium"
                              style={{ 
                                top: '10px', 
                                right: '10px', 
                                backgroundColor: '#A7EA7B', 
                                color: '#163300',
                                fontSize: '12px',
                                width: '47px',
                                height: '20px',
                                borderRadius: '9999px'
                              }}
                            >
                              ראשית
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ borderRadius: '12px', gap: '8px' }}>
                            {!img.isPrimary && (
                              <button
                                type="button"
                                onClick={() => setPrimaryImage(index)}
                                className="font-medium flex items-center justify-center"
                                style={{ 
                                  backgroundColor: '#91DCED', 
                                  color: '#003233',
                                  fontSize: '12px',
                                  width: '77px',
                                  height: '20px',
                                  borderRadius: '9999px'
                                }}
                              >
                                הפוך לראשית
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeImageAtIndex(index)}
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
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-lg transition border-gray-300 cursor-pointer hover:border-gray-400 hover:bg-gray-50"
                  >
                    <ImageIcon size={20} color="#9CA3AF" />
                    <span className="text-gray-600">לחץ להעלאת תמונות (עד 20MB)</span>
                  </label>
                </div>
                </div>

                {/* Gallery Videos */}
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">סרטונים</h3>
                    <p className="text-sm text-gray-500 mt-1">סרטונים שיוצגו בעמוד הקהילה</p>
                    <p className="text-xs text-gray-500 mt-1">תומך בסרטונים של YouTube, Vimeo, Dailymotion או העלאת סרטון אישי</p>
                  </div>
                  <div className="flex-1 space-y-3">
                    {galleryVideos.length > 0 && (
                      <div className="space-y-2">
                        {galleryVideos.map((videoUrl, index) => {
                          const provider = getVideoProvider(videoUrl);
                          return (
                            <div 
                              key={index} 
                              className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-300"
                            >
                              <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0">
                                <VideoThumbnail url={videoUrl} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-500">{getProviderLabel(provider)}</span>
                                <span className="block text-sm text-gray-700 truncate" dir="ltr">{videoUrl}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setGalleryVideos(prev => prev.filter((_, i) => i !== index))}
                                className="p-1 text-gray-400 hover:text-[#B3261E] transition"
                              >
                                <CloseIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Video URL input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="קישור לסרטון"
                        className="w-full p-3.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right resize-none text-base placeholder:text-right"
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (images.length + galleryVideos.length + galleryVideoFiles.length >= 10) {
                            setMessage('אפשר להעלות עד 10 תמונות/סרטונים');
                            setMessageType('error');
                            return;
                          }
                          if (newVideoUrl.trim() && isValidVideoUrl(newVideoUrl.trim())) {
                            setGalleryVideos(prev => [...prev, newVideoUrl.trim()]);
                            setNewVideoUrl('');
                          }
                        }}
                        disabled={!newVideoUrl.trim() || !isValidVideoUrl(newVideoUrl.trim())}
                        className="px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <span>הוסף</span>
                        <VideoIcon size={16} color="#FFFFFF" />
                      </button>
                    </div>
                    {/* MP4 Upload */}
                    <div>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        id="gallery-video-upload"
                        onChange={(e) => {
                          if (images.length + galleryVideos.length + galleryVideoFiles.length >= 10) {
                            setMessage('אפשר להעלות עד 10 תמונות/סרטונים');
                            setMessageType('error');
                            e.target.value = '';
                            return;
                          }
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith('video/')) {
                              setMessage('ניתן להעלות רק קבצי וידאו');
                              setMessageType('error');
                              e.target.value = '';
                              return;
                            }
                            if (file.size > MAX_VIDEO_SIZE_BYTES) {
                              setMessage('גודל הקובץ חורג מ-100MB');
                              setMessageType('error');
                              e.target.value = '';
                              return;
                            }
                            setGalleryVideoFiles(prev => [...prev, file]);
                          }
                          e.target.value = '';
                        }}
                      />
                      <label
                        htmlFor="gallery-video-upload"
                        className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition text-sm text-gray-600"
                      >
                        <VideoIcon size={16} color="#6B7280" />
                        העלאת סרטון (עד 100MB)
                      </label>
                    </div>
                    {/* Pending video file uploads */}
                    {galleryVideoFiles.length > 0 && (
                      <div className="space-y-2">
                        {galleryVideoFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="w-16 h-12 bg-gray-800 rounded flex items-center justify-center">
                              <VideoIcon size={20} color="#9CA3AF" />
                            </div>
                            <span className="flex-1 text-sm text-gray-700 truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setGalleryVideoFiles(prev => prev.filter((_, i) => i !== index))}
                              className="p-1 text-gray-400 hover:text-[#B3261E] transition"
                            >
                              <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Show Online Members Toggle */}
                <div className="flex items-center justify-between gap-6">
                  <div className="flex-1 text-right">
                    <h3 className="font-medium text-gray-900 text-base">הצגת חברים מחוברים</h3>
                    <p className="text-sm text-gray-500 mt-1">הצגת מספר החברים המחוברים כרגע בעמוד הפיד</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnlineMembers(!showOnlineMembers)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                    style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full border" 
                      style={{ borderColor: '#1D1D20', backgroundColor: showOnlineMembers ? '#A7EA7B' : '#D1D5DB' }} 
                    />
                    {showOnlineMembers ? 'כבה תצוגה' : 'הפעל תצוגה'}
                  </button>
                </div>

                {/* Delete Community - Only for owners */}
                {isOwner && (
                  <div className="flex items-center justify-between gap-6 pt-6 border-t border-gray-200">
                    <div className="flex-1">
                      <h3 className="font-medium text-base text-black">מחיקת קהילה</h3>
                      <p className="text-sm text-gray-500 mt-1">מחיקת הקהילה תמחוק את כל התוכן, החברים, התגובות והתשלומים שנעשו בתוכה. הפעולה הזאת לא הפיכה</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="py-3 px-6 text-white rounded-lg font-medium transition-colors text-base hover:opacity-90 flex-shrink-0"
                      style={{ backgroundColor: '#B3261E' }}
                    >
                      <span>מחק קהילה לצמיתות</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Rules Tab */}
            {activeTab === 'rules' && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">כללי הקהילה</h3>
                    <p className="text-sm text-gray-500 mt-1">הכללים שחברי הקהילה יראו בעמוד הפיד. אפשר להוסיף עד 3 כללים</p>
                  </div>
                  <div className="flex-1 space-y-3">
                  {rules.length > 0 && (
                    <div className="space-y-2">
                      {rules.map((rule, index) => (
                        <div 
                          key={index} 
                          className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200"
                        >
                          <CheckIcon className="w-4 h-4 flex-shrink-0 text-[#A7EA7B]" />
                          <span className="flex-1 text-sm text-gray-700">{rule}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(index)}
                            className="p-1 text-gray-400 hover:text-[#B3261E] transition"
                          >
                            <CloseIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="כלל חדש..."
                      className="flex-1 p-3.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-right text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={newRule}
                      onChange={(e) => {
                        if (e.target.value.length <= 50) setNewRule(e.target.value);
                      }}
                      maxLength={50}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRule();
                        }
                      }}
                      disabled={rules.length >= 3}
                    />
                    <button
                      type="button"
                      onClick={handleAddRule}
                      disabled={!newRule.trim() || rules.length >= 3}
                      className="px-5 py-3.5 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-2 text-base"
                    >
                      הוסף
                      <PlusIcon size={12} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {newRule.length}/50 תווים
                  </p>
                  </div>
                </div>
              </div>
            )}

            {/* Social Links Tab */}
            {activeTab === 'social' && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
                <div className="flex gap-8">
                  <div className="w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">רשתות חברתיות</h3>
                    <p className="text-sm text-gray-500 mt-1">קישורים לפרופילים החברתיים שלכם</p>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="relative">
                        <FaYoutube className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500" />
                        <input
                          type="url"
                          placeholder="קישור לערוץ YouTube"
                          className={`w-full p-3.5 pr-12 border rounded-lg focus:outline-none text-right text-base ${
                            youtubeUrl && !youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')
                              ? 'border-[#B3261E] focus:ring-2 focus:ring-[#B3261E] focus:border-black'
                              : 'border-gray-300 focus:ring-2 focus:ring-black focus:border-black'
                          }`}
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                        />
                      </div>
                      {youtubeUrl && !youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be') && (
                        <p className="text-xs text-[#B3261E] mt-1 text-right">הקישור צריך להיות מ-YouTube</p>
                      )}
                    </div>
                    <div>
                      <div className="relative">
                        <FaWhatsapp className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" />
                        <input
                          type="url"
                          placeholder="קישור לקבוצת WhatsApp"
                          className={`w-full p-3.5 pr-12 border rounded-lg focus:outline-none text-right text-base ${
                            whatsappUrl && !whatsappUrl.includes('whatsapp.com') && !whatsappUrl.includes('wa.me') && !whatsappUrl.includes('chat.whatsapp')
                              ? 'border-[#B3261E] focus:ring-2 focus:ring-[#B3261E] focus:border-black'
                              : 'border-gray-300 focus:ring-2 focus:ring-black focus:border-black'
                          }`}
                          value={whatsappUrl}
                          onChange={(e) => setWhatsappUrl(e.target.value)}
                        />
                      </div>
                      {whatsappUrl && !whatsappUrl.includes('whatsapp.com') && !whatsappUrl.includes('wa.me') && !whatsappUrl.includes('chat.whatsapp') && (
                        <p className="text-xs text-[#B3261E] mt-1 text-right">הקישור צריך להיות מ-WhatsApp</p>
                      )}
                    </div>
                    <div>
                      <div className="relative">
                        <FaFacebook className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600" />
                        <input
                          type="url"
                          placeholder="קישור לעמוד Facebook"
                          className={`w-full p-3.5 pr-12 border rounded-lg focus:outline-none text-right text-base ${
                            facebookUrl && !facebookUrl.includes('facebook.com') && !facebookUrl.includes('fb.com') && !facebookUrl.includes('fb.me')
                              ? 'border-[#B3261E] focus:ring-2 focus:ring-[#B3261E] focus:border-black'
                              : 'border-gray-300 focus:ring-2 focus:ring-black focus:border-black'
                          }`}
                          value={facebookUrl}
                          onChange={(e) => setFacebookUrl(e.target.value)}
                        />
                      </div>
                      {facebookUrl && !facebookUrl.includes('facebook.com') && !facebookUrl.includes('fb.com') && !facebookUrl.includes('fb.me') && (
                        <p className="text-xs text-[#B3261E] mt-1 text-right">הקישור צריך להיות מ-Facebook</p>
                      )}
                    </div>
                    <div>
                      <div className="relative">
                        <FaInstagram className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-500" />
                        <input
                          type="url"
                          placeholder="קישור לעמוד Instagram"
                          className={`w-full p-3.5 pr-12 border rounded-lg focus:outline-none text-right text-base ${
                            instagramUrl && !instagramUrl.includes('instagram.com') && !instagramUrl.includes('instagr.am')
                              ? 'border-[#B3261E] focus:ring-2 focus:ring-[#B3261E] focus:border-black'
                              : 'border-gray-300 focus:ring-2 focus:ring-black focus:border-black'
                          }`}
                          value={instagramUrl}
                          onChange={(e) => setInstagramUrl(e.target.value)}
                        />
                      </div>
                      {instagramUrl && !instagramUrl.includes('instagram.com') && !instagramUrl.includes('instagr.am') && (
                        <p className="text-xs text-[#B3261E] mt-1 text-right">הקישור צריך להיות מ-Instagram</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && isOwner && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-42">
                  <div>
                    <h3 className="font-medium text-gray-900 text-base">מחיר חודשי</h3>
                    <p className="text-sm text-gray-500 mt-1">בחר/י אם להצטרפות לקהילה יש עלות</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="inline-flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPaidCommunity(false);
                          setPrice(0);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-base font-normal border transition ${
                          !isPaidCommunity
                            ? 'border-black bg-white text-gray-600'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <NoFeeIcon className="w-4.5 h-4.5 text-gray-600" />
                        <span>חינם להצטרפות</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${
                          !isPaidCommunity ? 'border-black' : 'border-gray-300'
                        }`}>
                          {!isPaidCommunity && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#91DCED' }} />}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPaidCommunity(true);
                          if (price < 10) setPrice(10);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-base font-normal border transition ${
                          isPaidCommunity
                            ? 'border-black bg-white text-gray-600'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <DollarIcon className="w-4.5 h-4.5 text-gray-600" />
                        <span>מנוי בתשלום</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${
                          isPaidCommunity ? 'border-black' : 'border-gray-300'
                        }`}>
                          {isPaidCommunity && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#A7EA7B' }} />}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6 pt-6 border-t border-gray-200">
                  <div className={`flex-1 ${!isPaidCommunity ? 'opacity-50' : ''}`}>
                    <h3 className="font-medium text-gray-900 text-base">עלות מנוי חודשי</h3>
                    <p className="text-sm text-gray-500 mt-1">סכום החיוב החודשי (בשקלים) לכל חבר קהילה (ניתן לשנות בהמשך)</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <span className={`px-5 py-3.5 bg-gray-50 text-lg font-medium border-l border-gray-300 ${
                        isPaidCommunity ? 'text-gray-600' : 'text-gray-300'
                      }`}>₪</span>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        step="1"
                        placeholder=""
                        className={`w-108 p-3.5 text-right text-lg focus:outline-none ${
                          isPaidCommunity
                            ? 'bg-white'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                        value={isPaidCommunity ? price : ''}
                        onChange={(e) => setPrice(Math.max(10, Math.min(1000, parseInt(e.target.value) || 10)))}
                        disabled={!isPaidCommunity}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6 pt-6 border-t border-gray-200">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 text-base">חיוב ותשלומים</h3>
                    {!trialCancelled && trialStartDate ? (
                      <p className="text-sm text-gray-500 mt-1">
                        תקופת הניסיון שלך (7 ימים) מסתיימת בתאריך {new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('he-IL')}.
                        {` החל מ-${new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('he-IL')} יחויב אמצעי התשלום שלך ב99₪ לחודש.`}
                      </p>
                    ) : trialCancelled ? (
                      <p className="text-sm text-gray-500 mt-1">תקופת הניסיון בוטלה.</p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1">נהל את אמצעי התשלום שלך.</p>
                    )}
                    {cardLastFour && (
                      <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                        <CreditCardIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>כרטיס נוכחי: {cardBrand || 'Visa'} ************{cardLastFour}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-2">
                    {!trialCancelled && trialStartDate && (
                      <button
                        type="button"
                        onClick={() => setShowCancelTrialModal(true)}
                        className="py-2.5 px-5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition text-sm"
                      >
                        ביטול תקופת ניסיון
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowCardModal(true)}
                      className="py-2.5 px-5 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition text-sm"
                    >
                      עדכון אמצעי תשלום
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Message Banner */}
            {message && (
              <div
                ref={messageRef}
                className="mt-4 px-6 py-3 rounded-lg"
                style={messageType === 'error' 
                  ? { backgroundColor: '#FEE2E2', color: '#B3261E' }
                  : { backgroundColor: '#A7EA7B', color: 'black', fontSize: '16px', fontWeight: 400 }
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{message}</span>
                  <button
                    type="button"
                    onClick={() => setMessage('')}
                    className="text-current opacity-60 hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-gray-200">
              <Link
                href={`/communities/${communityId}/feed`}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                ביטול
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </form>

          {/* Credit Card Modal - Outside form */}
          {showCardModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md" dir="rtl">
                <button
                  type="button"
                  onClick={() => {
                    setShowCardModal(false);
                    setNewCardNumber('');
                    setNewCardExpiry('');
                    setNewCardCvv('');
                  }}
                  className="text-gray-400 hover:text-gray-600 mb-4"
                >
                  <CloseIcon size={20} />
                </button>
                
                <h2 className="text-2xl font-bold text-center mb-8">עדכון אמצעי תשלום</h2>
                
                {cardLastFour && (
                  <p className="text-center text-gray-600 mb-4">
                    כרטיס נוכחי: <strong>{cardBrand || 'Visa'} ************{cardLastFour}</strong>
                  </p>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-right">מספר כרטיס</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newCardNumber}
                        onChange={(e) => setNewCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                        className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                          newCardNumber.length > 0 && newCardNumber.length < 16 ? 'border-red-400' : 'border-gray-300'
                        }`}
                      />
                      <CreditCardIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    </div>
                    {newCardNumber.length > 0 && newCardNumber.length < 16 && (
                      <p className="text-red-500 text-sm mt-1">חסרות {16 - newCardNumber.length} ספרות</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-right">תוקף</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={newCardExpiry}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const rawValue = newValue.replace(/\D/g, '').slice(0, 4);
                            
                            if (rawValue.length > 2) {
                              // 3-4 digits: always show with slash (MM/Y or MM/YY)
                              setNewCardExpiry(rawValue.slice(0, 2) + '/' + rawValue.slice(2));
                            } else if (rawValue.length === 2 && newValue.length > newCardExpiry.length) {
                              // Exactly 2 digits AND typing forward: add slash
                              setNewCardExpiry(rawValue + '/');
                            } else {
                              // 0-2 digits while deleting: just show raw
                              setNewCardExpiry(rawValue);
                            }
                          }}
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                            newCardExpiry.length > 0 && (newCardExpiry.length < 5 || (() => {
                              if (newCardExpiry.length !== 5) return false;
                              const [m, y] = newCardExpiry.split('/').map(Number);
                              const now = new Date();
                              const cm = now.getMonth() + 1;
                              const cy = now.getFullYear() % 100;
                              return y < cy || (y === cy && m < cm);
                            })()) ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        <CalendarIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                      {newCardExpiry.length > 0 && newCardExpiry.length < 5 && (
                        <p className="text-red-500 text-sm mt-1">פורמט: MM/YY</p>
                      )}
                      {newCardExpiry.length === 5 && (() => {
                        const [m, y] = newCardExpiry.split('/').map(Number);
                        const now = new Date();
                        const cm = now.getMonth() + 1;
                        const cy = now.getFullYear() % 100;
                        return y < cy || (y === cy && m < cm);
                      })() && (
                        <p className="text-red-500 text-sm mt-1">הכרטיס פג תוקף</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-right">CVV</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={newCardCvv}
                          onChange={(e) => setNewCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black ${
                            newCardCvv.length > 0 && newCardCvv.length < 3 ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        <LockIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      </div>
                      {newCardCvv.length > 0 && newCardCvv.length < 3 && (
                        <p className="text-red-500 text-sm mt-1">חסרות {3 - newCardCvv.length} ספרות</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={async () => {
                    console.log('Save card clicked', { newCardNumber, newCardExpiry, newCardCvv });
                    if (newCardNumber.length !== 16) {
                      setMessage('מספר כרטיס חייב להכיל 16 ספרות');
                      setMessageType('error');
                      return;
                    }
                    if (newCardExpiry.length !== 5) {
                      setMessage('תוקף לא תקין');
                      setMessageType('error');
                      return;
                    }
                    // Check if expiry date is in the past
                    const [expMonth, expYear] = newCardExpiry.split('/').map(Number);
                    const now = new Date();
                    const currentMonth = now.getMonth() + 1;
                    const currentYear = now.getFullYear() % 100;
                    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
                      setMessage('הכרטיס פג תוקף');
                      setMessageType('error');
                      return;
                    }
                    if (newCardCvv.length !== 3) {
                      setMessage('CVV חייב להכיל 3 ספרות');
                      setMessageType('error');
                      return;
                    }
                    try {
                      const token = localStorage.getItem('token');
                      const lastFour = newCardNumber.slice(-4);
                      
                      // Save to community
                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ 
                          cardLastFour: lastFour,
                          cardBrand: 'Visa',
                        }),
                      });
                      
                      // Also save to user payment methods
                      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ 
                          cardLastFour: lastFour,
                          cardBrand: 'Visa',
                        }),
                      });
                      
                      if (res.ok) {
                        setCardLastFour(lastFour);
                        setCardBrand('Visa');
                        setShowCardModal(false);
                        setNewCardNumber('');
                        setNewCardExpiry('');
                        setNewCardCvv('');
                        setMessage('אמצעי התשלום עודכן בהצלחה');
                        setMessageType('success');
                      } else {
                        setMessage('שגיאה בעדכון אמצעי התשלום');
                        setMessageType('error');
                      }
                    } catch (err) {
                      console.error('Error saving card', err);
                      setMessage('שגיאה בעדכון אמצעי התשלום');
                      setMessageType('error');
                    }
                  }}
                  className="w-full mt-8 bg-black text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition"
                >
                  שמור כרטיס
                </button>
                
                <p className="text-center text-sm text-gray-500 mt-4">
                  הכרטיס ישמש לחיוב המנוי החודשי של הקהילה.
                </p>
              </div>
            </div>
          )}

          {/* Cancel Trial Confirmation Modal - Outside form */}
          {showCancelTrialModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full text-right" dir="rtl">
                <h2 className="text-xl font-bold text-gray-900 mb-4">ביטול תקופת ניסיון</h2>
                <p className="text-gray-600 mb-6">
                  האם אתה בטוח שברצונך לבטל את תקופת הניסיון?
                  <br />
                  <span className="text-red-600 font-medium">לאחר הביטול, הקהילה תיסגר ולא תוכל לגבות תשלומים מהחברים.</span>
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCancelTrialModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
                    disabled={cancellingTrial}
                  >
                    חזור
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setCancellingTrial(true);
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                          body: JSON.stringify({ trialCancelled: true }),
                        });
                        if (res.ok) {
                          setTrialCancelled(true);
                          setShowCancelTrialModal(false);
                          setMessage('תקופת הניסיון בוטלה בהצלחה');
                          setMessageType('success');
                        }
                      } catch {
                        setMessage('שגיאה בביטול תקופת הניסיון');
                        setMessageType('error');
                      } finally {
                        setCancellingTrial(false);
                      }
                    }}
                    disabled={cancellingTrial}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {cancellingTrial ? 'מבטל...' : 'בטל תקופת ניסיון'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && isOwner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-right" dir="rtl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">מחיקת קהילה</h2>
            <p className="text-gray-600 mb-6">
              האם אתה בטוח שברצונך למחוק את הקהילה <strong>"{community?.name}"</strong>?
              <br />
              <span className="text-[#B3261E] font-medium">פעולה זו אינה ניתנת לביטול!</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
                disabled={deleting}
              >
                ביטול
              </button>
              <button
                onClick={handleDeleteCommunity}
                disabled={deleting}
                className="px-4 py-2 bg-[#B3261E] text-white rounded-lg font-medium hover:bg-[#9C2019] disabled:opacity-50 transition flex items-center gap-2"
              >
                {deleting ? 'מוחק...' : 'מחק לצמיתות'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
