'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { compressImage, MAX_IMAGE_SIZE_BYTES } from '../../lib/imageCompression';
import { useUser } from '../../lib/UserContext';
import FormSelect from '../../components/FormSelect';
import { HiOutlineUser, HiOutlineCamera, HiOutlineCog6Tooth, HiOutlineEye, HiOutlineEyeSlash, HiOutlineHeart, HiOutlineChatBubbleOvalLeft, HiOutlineUserPlus, HiOutlineUsers, HiOutlineEnvelope, HiOutlineDocumentText, HiOutlineAtSymbol, HiOutlineCreditCard } from 'react-icons/hi2';
import CloseIcon from '../../components/icons/CloseIcon';
import PowerIcon from '../../components/icons/PowerIcon';
import PowerOffIcon from '../../components/icons/PowerOffIcon';
import CreditCardIcon from '../../components/icons/CreditCardIcon';
import TrashIcon from '../../components/icons/TrashIcon';
import LockIcon from '../../components/icons/LockIcon';
import CalendarIcon from '../../components/icons/CalendarIcon';
import LeaveCommunityModal from '../../components/LeaveCommunityModal';
import CancelSubscriptionModal from '../../components/CancelSubscriptionModal';
import UpdateCardModal from '../../components/UpdateCardModal';
import HypPaymentIframeModal from '../../components/HypPaymentIframeModal';
import StickySaveBar from '../../components/StickySaveBar';
import { getImageUrl } from '@/app/lib/imageUrl';

interface Membership {
  communityId: string;
  name: string;
  slug: string | null;
  logo: string | null;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
  isPaid: boolean;
  price: number;
  joinedAt: string | null;
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED' | null;
  subscriptionCancelledAt: string | null;
  suspendedAt: string | null;
  nextBillDate: string | null;
  effectiveEndDate: string | null;
  paidMembersCount: number | null;
}

const formatHebrewDate = (iso: string): string => new Date(iso).toLocaleDateString('he-IL');

// Password requirements (same as signup)
const passwordRequirements = [
  { id: 'length', label: 'לפחות 6 תווים', test: (p: string) => p.length >= 6 },
  { id: 'letter', label: 'לפחות אות אחת', test: (p: string) => /[a-zA-Z]/.test(p) },
  { id: 'number', label: 'לפחות מספר אחד', test: (p: string) => /[0-9]/.test(p) },
];

// Israeli cities list
const ISRAELI_CITIES = [
  '',
  'תל אביב',
  'ירושלים',
  'חיפה',
  'באר שבע',
  'ראשון לציון',
  'פתח תקווה',
  'אשדוד',
  'נתניה',
  'חולון',
  'בת ים',
  'בני ברק',
  'רמת גן',
  'אשקלון',
  'רחובות',
  'הרצליה',
  'כפר סבא',
  'ביתר עילית',
  'מודיעין',
  'נזרת עילית',
  'לוד',
  'רמלה',
  'רעננה',
  'הוד השרון',
  'עפולה',
  'נהריה',
  'קרית',
  'אילת',
  'טבריה',
  'עכו',
  'צפת',
  'דימונה',
  'קרית אתא',
  'קרית גת',
  'קרית ביאליק',
  'קרית מלאכי',
  'קרית מוצקין',
  'קרית אונו',
  'קרית שמונה',
  'יבנה',
  'אור יהודה',
  'אור עקיבא',
  'גבעתיים',
  'נס ציונה',
  'סדרות',
  'עפרה',
  'כפר קסם',
  'כרמיאל',
  'טירת הכרמל',
  'מעלות אדומים',
  'מעלות תרשיחא',
  'שדרות',
  'נתיבות',
  'אחר',
];

interface UserProfile {
  userId: string;
  email: string;
  name: string;
  profileImage: string | null;
  bio: string | null;
  location: string | null;
  isGoogleAccount?: boolean;
}

type TabType = 'profile' | 'security' | 'notifications' | 'payment';

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user, refresh: refreshUser, setLoggedOut } = useUser();
  const userId = user?.userId ?? null;
  const userEmail = user?.email ?? null;
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingOffline, setSettingOffline] = useState(false);
  const [showOnline, setShowOnline] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Notification preferences state
  const [notifyLikes, setNotifyLikes] = useState(false);
  const [notifyComments, setNotifyComments] = useState(false);
  const [notifyFollows, setNotifyFollows] = useState(false);
  const [notifyNewPosts, setNotifyNewPosts] = useState(false);
  const [notifyMentions, setNotifyMentions] = useState(false);
  const [notifyCommunityJoins, setNotifyCommunityJoins] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Credit card state
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; cardLastFour: string; cardBrand: string; createdAt: string; isPrimary: boolean; inUseCommunities: string[] }[]>([]);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [cardToDelete, setCardToDelete] = useState<{ id: string; cardBrand: string; cardLastFour: string } | null>(null);
  const [cardBlocked, setCardBlocked] = useState<{ cardBrand: string; cardLastFour: string; communityNames: string[] } | null>(null);

  // My Memberships
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [communityToLeaveFree, setCommunityToLeaveFree] = useState<Membership | null>(null);
  const [communityToLeavePaid, setCommunityToLeavePaid] = useState<Membership | null>(null);
  const [communityToCancelSub, setCommunityToCancelSub] = useState<Membership | null>(null);
  const [communityToRenew, setCommunityToRenew] = useState<Membership | null>(null);
  const [leavingCommunityId, setLeavingCommunityId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  
  // Message state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const messageRef = useRef<HTMLDivElement>(null);

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

  // Track initial form values for unsaved changes detection
  const initialFormRef = useRef<{ name: string; bio: string; location: string } | null>(null);

  const hasUnsavedChanges = () => {
    const init = initialFormRef.current;
    if (!init) return false;
    return (
      name !== init.name ||
      bio !== init.bio ||
      location !== init.location ||
      profileImage !== null
    );
  };

  // Keep a ref in sync so stable closures can read latest value
  const shouldBlockRef = useRef(false);
  useEffect(() => {
    shouldBlockRef.current = hasUnsavedChanges();
  });

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
      if (anchor.origin !== window.location.origin) return;
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

  useEffect(() => {
    // Open a specific tab when redirected with a hash (e.g. /settings#payment).
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash === 'profile' || hash === 'security' || hash === 'notifications' || hash === 'payment') {
        setActiveTab(hash);
      }
    }

    if (!user) {
      router.push('/login');
      return;
    }

    // Profile fetch: still needed because UserContext only carries
    // userId/email/name/profileImage — bio/location/isGoogleAccount come
    // from /users/me directly.
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data: UserProfile) => {
        setUserProfile(data);
        setName(data.name || '');
        setBio(data.bio || '');
        setLocation(data.location || '');
        initialFormRef.current = {
          name: data.name || '',
          bio: data.bio || '',
          location: data.location || '',
        };
        if (data.profileImage) {
          setImagePreview(getImageUrl(data.profileImage));
        }
      })
      .catch(console.error);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/online-status`)
      .then(res => res.json())
      .then(data => setShowOnline(data.showOnline))
      .catch(console.error);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/notification-preferences`)
      .then(res => res.json())
      .then(data => {
        setNotifyLikes(data.notifyLikes ?? true);
        setNotifyComments(data.notifyComments ?? true);
        setNotifyFollows(data.notifyFollows ?? true);
        setNotifyNewPosts(data.notifyNewPosts ?? true);
        setNotifyMentions(data.notifyMentions ?? true);
        setNotifyCommunityJoins(data.notifyCommunityJoins ?? true);
      })
      .catch(console.error);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`)
      .then(res => res.json())
      .then(data => setPaymentMethods(data))
      .catch(console.error);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/memberships`)
      .then(res => res.json())
      .then(data => setMemberships(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [router, user]);

  // After a successful tokenize redirect (Phase 3.1), the backend lands the
  // user here with ?card=added (or ?card=error). Surface the result, refresh
  // the card list, and scrub the query so a refresh doesn't replay the toast.
  const searchParams = useSearchParams();
  useEffect(() => {
    const cardStatus = searchParams.get('card');
    if (!cardStatus) return;
    if (cardStatus === 'added' || cardStatus === 'existing') {
      setMessage(
        cardStatus === 'added'
          ? 'הכרטיס נוסף בהצלחה'
          : 'הכרטיס היה כבר שמור, פרטיו עודכנו',
      );
      setMessageType('success');
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`)
        .then(res => res.json())
        .then(data => setPaymentMethods(data))
        .catch(console.error);
    } else if (cardStatus === 'error') {
      setMessage('שגיאה בהוספת הכרטיס. נסה שוב.');
      setMessageType('error');
    }
    // Strip the query but keep the #payment hash so we stay on the right tab.
    window.history.replaceState(null, '', '/settings#payment');
  }, [searchParams]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return;
      }
      // Compress image before setting
      const compressedFile = await compressImage(file);
      setProfileImage(compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    }
  };

  // Revert the profile form to its last-saved values and stay on the page.
  const handleResetProfile = () => {
    const init = initialFormRef.current;
    if (!init) return;
    setName(init.name);
    setBio(init.bio);
    setLocation(init.location);
    setProfileImage(null);
    setImagePreview(
      userProfile?.profileImage ? getImageUrl(userProfile.profileImage) : null
    );
    setMessage('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!user) {
      router.push('/login');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const formData = new FormData();
      if (name.trim()) {
        formData.append('name', name.trim());
      }
      if (bio.trim()) {
        formData.append('bio', bio.trim());
      }
      if (location) {
        formData.append('location', location);
      }
      if (profileImage) {
        formData.append('profileImage', profileImage);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        method: 'PATCH',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedProfile = await res.json();
      setUserProfile(updatedProfile);
      setProfileImage(null);

      if (updatedProfile.profileImage) {
        setImagePreview(getImageUrl(updatedProfile.profileImage));
      }

      // Refresh UserContext so SiteHeader and other consumers see the update.
      void refreshUser();

      // Show success message
      setMessage('השינויים נשמרו בהצלחה');
      setMessageType('success');
      // Re-snapshot to the just-saved values: clears the dirty state (bar hides,
      // beforeunload won't trigger) while still tracking further edits.
      initialFormRef.current = { name, bio, location };
    } catch (err: any) {
      console.error('Profile update error:', err);
      setMessage(err.message || 'שגיאה בעדכון הפרופיל');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOnlineStatus = async () => {
    if (!user) return;

    try {
      setSettingOffline(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/online-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showOnline: !showOnline }),
      });

      if (!res.ok) {
        throw new Error('Failed to toggle online status');
      }

      const data = await res.json();
      setShowOnline(data.showOnline);
      setMessage(data.showOnline ? 'הסטטוס שונה למחובר' : 'הסטטוס שונה ללא מחובר');
      setMessageType('success');
    } catch (err: any) {
      console.error('Toggle online status error:', err);
      setMessage('שגיאה בשינוי סטטוס');
      setMessageType('error');
    } finally {
      setSettingOffline(false);
    }
  };

  const saveNotificationPreference = async (key: string, value: boolean) => {
    if (!user) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [key]: value,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save notification preferences');
      }
    } catch (err: any) {
      console.error('Save notification preference error:', err);
    }
  };

  const toggleNotifyLikes = () => {
    const newValue = !notifyLikes;
    setNotifyLikes(newValue);
    saveNotificationPreference('notifyLikes', newValue);
  };

  const toggleNotifyComments = () => {
    const newValue = !notifyComments;
    setNotifyComments(newValue);
    saveNotificationPreference('notifyComments', newValue);
  };

  const toggleNotifyFollows = () => {
    const newValue = !notifyFollows;
    setNotifyFollows(newValue);
    saveNotificationPreference('notifyFollows', newValue);
  };

  const toggleNotifyNewPosts = () => {
    const newValue = !notifyNewPosts;
    setNotifyNewPosts(newValue);
    saveNotificationPreference('notifyNewPosts', newValue);
  };

  const toggleNotifyMentions = () => {
    const newValue = !notifyMentions;
    setNotifyMentions(newValue);
    saveNotificationPreference('notifyMentions', newValue);
  };

  const toggleNotifyCommunityJoins = () => {
    const newValue = !notifyCommunityJoins;
    setNotifyCommunityJoins(newValue);
    saveNotificationPreference('notifyCommunityJoins', newValue);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('יש למלא את כל השדות');
      setMessageType('error');
      return;
    }

    // Check all password requirements
    const requirementsMet = passwordRequirements.every(req => req.test(newPassword));
    if (!requirementsMet) {
      setMessage('הסיסמה החדשה חייבת להכיל לפחות 6 תווים, אות אחת ומספר אחד');
      setMessageType('error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('הסיסמאות אינן תואמות');
      setMessageType('error');
      return;
    }

    if (newPassword === currentPassword) {
      setMessage('הסיסמה החדשה לא יכולה להיות זהה לסיסמה הנוכחית');
      setMessageType('error');
      return;
    }

    try {
      setChangingPassword(true);
      setMessage('');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to change password');
      }

      setMessage('הסיסמה שונתה בהצלחה!');
      setMessageType('success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Password change error:', err);
      setMessage(err.message || 'שגיאה בשינוי הסיסמה');
      setMessageType('error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    if (deleteConfirmText !== 'מחיקת החשבון שלי') {
      setMessage('יש להקליד את הטקסט המדויק לאישור');
      setMessageType('error');
      return;
    }

    try {
      setDeletingAccount(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete account');
      }

      setLoggedOut();
      setMessage('מחיקת המשתמש עברה בהצלחה');
      setMessageType('success');
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
      
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      console.error('Delete account error:', err);
      setMessage('שגיאה במחיקת החשבון');
      setMessageType('error');
      setDeletingAccount(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-72px)] text-right" style={{ backgroundColor: '#F4F4F5' }} dir="rtl">
      {/* Mobile Tab Bar */}
      <div className="md:hidden flex overflow-x-auto bg-white px-3 py-2 gap-1 border-b scrollbar-hide" style={{ borderColor: '#E1E1E2', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
        {[
          { key: 'profile' as const, label: 'פרטי פרופיל' },
          { key: 'security' as const, label: 'אבטחה' },
          { key: 'notifications' as const, label: 'התראות' },
          { key: 'payment' as const, label: 'תשלומים' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveTab(tab.key); setMessage(''); }}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition ${
              activeTab === tab.key
                ? 'bg-gray-900 text-white font-medium'
                : 'text-gray-600 hover:bg-gray-100 font-normal'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Layout with Sidebar */}
      <div className="flex min-h-[calc(100vh-72px)]">
        {/* Right Sidebar - Settings Tabs (hidden on mobile) */}
        <aside className="hidden md:block w-64 bg-white border-l p-6 flex-shrink-0" style={{ borderColor: '#E1E1E2' }}>
          <div className="flex items-center gap-2 mb-6">
            <HiOutlineCog6Tooth className="w-5 h-5" style={{ color: '#000000' }} />
            <h2 className="font-semibold" style={{ color: '#1D1D20', fontSize: '21px' }}>הגדרות</h2>
          </div>
          
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setMessage('');
              }}
              className="w-full text-right px-4 py-2.5 rounded-lg font-medium transition"
              style={{
                fontSize: '16px',
                backgroundColor: activeTab === 'profile' ? '#F4F4F5' : 'transparent',
                color: activeTab === 'profile' ? '#1D1D20' : '#52525B'
              }}
            >
              פרטי פרופיל
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('security');
                setMessage('');
              }}
              className="w-full text-right px-4 py-2.5 rounded-lg font-medium transition"
              style={{
                fontSize: '16px',
                backgroundColor: activeTab === 'security' ? '#F4F4F5' : 'transparent',
                color: activeTab === 'security' ? '#1D1D20' : '#52525B'
              }}
            >
              אבטחה
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('notifications');
                setMessage('');
              }}
              className="w-full text-right px-4 py-2.5 rounded-lg font-medium transition"
              style={{
                fontSize: '16px',
                backgroundColor: activeTab === 'notifications' ? '#F4F4F5' : 'transparent',
                color: activeTab === 'notifications' ? '#1D1D20' : '#52525B'
              }}
            >
              התראות
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('payment');
                setMessage('');
              }}
              className="w-full text-right px-4 py-2.5 rounded-lg font-medium transition"
              style={{
                fontSize: '16px',
                backgroundColor: activeTab === 'payment' ? '#F4F4F5' : 'transparent',
                color: activeTab === 'payment' ? '#1D1D20' : '#52525B'
              }}
            >
              תשלומים
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-8">
          <form onSubmit={handleSubmit} className="max-w-3xl pb-28">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl border p-4 md:p-6 space-y-6" style={{ borderColor: '#E1E1E2' }}>
                {/* Profile Photo */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                  <h3 className="text-sm font-medium w-32 flex-shrink-0" style={{ color: '#1D1D20' }}>תמונת פרופיל</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: '#E1E1E2' }}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold border-2" style={{ backgroundColor: '#FCE7F3', color: '#DB2777', borderColor: '#E1E1E2' }}>
                          {name?.charAt(0) || userEmail?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 w-7 h-7 bg-black rounded-full flex items-center justify-center hover:opacity-90 transition"
                      >
                        <HiOutlineCamera className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <div className="text-sm" style={{ color: '#71717A' }}>
                      <p>כדי לשנות את תמונת הפרופיל, אפשר ללחוץ על סימן המצלמה</p>
                      <p className="text-xs" style={{ color: '#A1A1AA' }}>JPG, PNG עד 5MB</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <h3 className="text-sm font-medium w-32 flex-shrink-0" style={{ color: '#1D1D20' }}>אימייל</h3>
                  <div className="flex-1 relative">
                    <HiOutlineEnvelope className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#A1A1AA' }} />
                    <input
                      type="email"
                      value={userEmail || ''}
                      disabled
                      className="w-full pr-11 pl-4 py-3 rounded-lg border text-sm"
                      style={{ borderColor: '#E1E1E2', backgroundColor: '#F4F4F5', color: '#71717A' }}
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div className="flex items-center gap-8">
                  <h3 className="text-sm font-medium w-32 flex-shrink-0" style={{ color: '#1D1D20' }}>שם מלא</h3>
                  <div className="flex-1 relative">
                    <HiOutlineUser className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#A1A1AA' }} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 50))}
                      placeholder="שם מלא"
                      maxLength={50}
                      className="w-full pr-11 pl-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-sm"
                      style={{ borderColor: '#E1E1E2' }}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#A1A1AA' }}>{name.length}/50</span>
                  </div>
                </div>

                {/* Bio */}
                <div className="flex items-start gap-8">
                  <div className="w-32 flex-shrink-0">
                    <h3 className="text-sm font-medium" style={{ color: '#1D1D20' }}>תיאור</h3>
                    <p className="text-sm" style={{ color: '#71717A' }}>ספרו על עצמכם</p>
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 300))}
                      placeholder="ספרו על עצמכם"
                      maxLength={300}
                      rows={5}
                      className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-sm resize-none overflow-y-auto text-right"
                      style={{ borderColor: '#E1E1E2' }}
                    />
                    <span className="absolute left-3 bottom-3 text-xs" style={{ color: '#A1A1AA' }}>{bio.length}/300</span>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-8">
                  <h3 className="text-sm font-medium w-32 flex-shrink-0" style={{ color: '#1D1D20' }}>עיר מגורים</h3>
                  <div className="flex-1">
                    <FormSelect
                      value={location}
                      onChange={setLocation}
                      placeholder="בחר עיר"
                      options={ISRAELI_CITIES.filter(city => city !== '').map(city => ({ value: city, label: city }))}
                    />
                  </div>
                </div>

                {/* Online Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium" style={{ color: '#1D1D20' }}>הסטטוס שלי</h3>
                    <p className="text-sm" style={{ color: '#71717A' }}>כרגע מוצג כמחובר לכל חברי הקהילות</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleOnlineStatus}
                    disabled={settingOffline}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                    style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full border" 
                      style={{ borderColor: '#1D1D20', backgroundColor: showOnline ? '#A7EA7B' : '#D1D5DB' }} 
                    />
                    {showOnline ? 'הפוך ללא מחובר' : 'הפוך למחובר'}
                    {showOnline ? (
                      <PowerOffIcon className="w-4 h-4" style={{ color: '#52525B' }} />
                    ) : (
                      <PowerIcon className="w-4 h-4" style={{ color: '#52525B' }} />
                    )}
                  </button>
                </div>

              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-xl border p-6 space-y-6" style={{ borderColor: '#E1E1E2' }}>
                {/* Change Password Section */}
                <div className={userProfile?.isGoogleAccount ? 'opacity-50 pointer-events-none' : ''}>
                  <h3 className="text-base font-semibold mb-4" style={{ color: '#1D1D20' }}>שינוי סיסמה</h3>
                  {userProfile?.isGoogleAccount && (
                    <p className="text-sm mb-4" style={{ color: '#71717A' }}>לא ניתן לשנות סיסמה עבור חשבונות Google</p>
                  )}
                
                  {/* Current Password */}
                  <div className="flex items-center gap-8 mb-4">
                    <div className="w-40 flex-shrink-0">
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>סיסמה נוכחית</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>יש להזין את הסיסמה הנוכחית</p>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={userProfile?.isGoogleAccount}
                        className="w-full pl-12 pr-4 py-3 rounded-full border focus:outline-none focus:ring-1 focus:border-black text-sm"
                        style={{ borderColor: '#E1E1E2' }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: '#A1A1AA' }}
                      >
                        {showCurrentPassword ? <HiOutlineEye className="w-5 h-5" /> : <HiOutlineEyeSlash className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="flex items-center gap-8 mb-4">
                    <div className="w-40 flex-shrink-0">
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>סיסמה חדשה</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>יש להזין סיסמה חדשה</p>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={userProfile?.isGoogleAccount}
                        className="w-full pl-12 pr-4 py-3 rounded-full border focus:outline-none focus:ring-1 focus:border-black text-sm"
                        style={{ borderColor: '#E1E1E2' }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: '#A1A1AA' }}
                      >
                        {showNewPassword ? <HiOutlineEye className="w-5 h-5" /> : <HiOutlineEyeSlash className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="flex items-center gap-8 mb-4">
                    <div className="w-40 flex-shrink-0">
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>אישור סיסמה חדשה</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>יש להזין את הסיסמה שוב</p>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={userProfile?.isGoogleAccount}
                        className="w-full pl-12 pr-4 py-3 rounded-full border focus:outline-none focus:ring-1 focus:border-black text-sm"
                        style={{ borderColor: '#E1E1E2' }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: '#A1A1AA' }}
                      >
                        {showConfirmPassword ? <HiOutlineEye className="w-5 h-5" /> : <HiOutlineEyeSlash className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={changingPassword || userProfile?.isGoogleAccount}
                      className="px-6 py-2.5 bg-black text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 text-sm"
                    >
                      {changingPassword ? 'משנה...' : 'שינוי סיסמה'}
                    </button>
                  </div>
                </div>

                {/* Delete Account */}
                <div className="pt-6 border-t" style={{ borderColor: '#E1E1E2' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>מחיקת חשבון</h4>
                      <p className="text-sm mt-1" style={{ color: '#71717A' }}>
                        מחיקת החשבון היא פעולה בלתי הפיכה. כל הנתונים שלך יימחקו לצמיתות, כולל:
                      </p>
                      <ul className="text-sm mt-2 space-y-1 list-disc list-inside" style={{ color: '#71717A' }}>
                        <li>כל הפוסטים שפרסמת</li>
                        <li>הקהילות שאתה הבעלים שלהן</li>
                        <li>כל התגובות שכתבת</li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition text-sm text-white hover:opacity-90 flex-shrink-0"
                      style={{ backgroundColor: '#B3261E' }}
                    >
                      אני רוצה למחוק את החשבון שלי
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E1E1E2' }}>
                <div className="space-y-6">
                  {/* Likes */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>לייקים</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>קבל התראה כשמישהו אוהב את הפוסט שלך</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleNotifyLikes}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                      style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border"
                        style={{ borderColor: '#1D1D20', backgroundColor: notifyLikes ? '#A7EA7B' : '#D1D5DB' }}
                      />
                      {notifyLikes ? 'בטל התראות' : 'הפעל התראות'}
                      <HiOutlineHeart className="w-5 h-5" style={{ color: '#A1A1AA' }} />
                    </button>
                  </div>

                  {/* Comments */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>תגובות</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>קבל התראה כשמישהו מגיב על הפוסט שלך</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleNotifyComments}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                      style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border"
                        style={{ borderColor: '#1D1D20', backgroundColor: notifyComments ? '#A7EA7B' : '#D1D5DB' }}
                      />
                      {notifyComments ? 'בטל התראות' : 'הפעל התראות'}
                      <HiOutlineChatBubbleOvalLeft className="w-5 h-5" style={{ color: '#A1A1AA' }} />
                    </button>
                  </div>

                  {/* Mentions */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>אזכורים</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>קבל התראה כשמישהו מזכיר אותך בתגובה</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleNotifyMentions}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                      style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border"
                        style={{ borderColor: '#1D1D20', backgroundColor: notifyMentions ? '#A7EA7B' : '#D1D5DB' }}
                      />
                      {notifyMentions ? 'בטל התראות' : 'הפעל התראות'}
                      <HiOutlineAtSymbol className="w-5 h-5" style={{ color: '#A1A1AA' }} />
                    </button>
                  </div>

                  {/* Community Joins */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>הצטרפות לקהילה</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>קבל התראה כשמישהו מצטרף לקהילה שלך</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleNotifyCommunityJoins}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                      style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border"
                        style={{ borderColor: '#1D1D20', backgroundColor: notifyCommunityJoins ? '#A7EA7B' : '#D1D5DB' }}
                      />
                      {notifyCommunityJoins ? 'בטל התראות' : 'הפעל התראות'}
                      <HiOutlineUserPlus className="w-5 h-5" style={{ color: '#A1A1AA' }} />
                    </button>
                  </div>

                  {/* New Followers */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>עוקבים חדשים</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>קבל התראה כשמישהו מתחיל לעקוב אחריך</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleNotifyFollows}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                      style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border"
                        style={{ borderColor: '#1D1D20', backgroundColor: notifyFollows ? '#A7EA7B' : '#D1D5DB' }}
                      />
                      {notifyFollows ? 'בטל התראות' : 'הפעל התראות'}
                      <HiOutlineUsers className="w-5 h-5" style={{ color: '#A1A1AA' }} />
                    </button>
                  </div>

                  {/* New Posts */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>פוסטים חדשים</h4>
                      <p className="text-sm" style={{ color: '#71717A' }}>קבל התראה כשמישהו שאתה עוקב אחריו מפרסם</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleNotifyNewPosts}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                      style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border"
                        style={{ borderColor: '#1D1D20', backgroundColor: notifyNewPosts ? '#A7EA7B' : '#D1D5DB' }}
                      />
                      {notifyNewPosts ? 'בטל התראות' : 'הפעל התראות'}
                      <HiOutlineDocumentText className="w-5 h-5" style={{ color: '#A1A1AA' }} />
                    </button>
                  </div>
                  {/* "הודעות פרטיות" used to live here. Removed — message
                      visibility is already conveyed by the bell badge on the
                      messages icon, no need for a per-user toggle. */}
                </div>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold" style={{ color: '#3F3F46' }}>אמצעי תשלום</h2>
                  <button
                    type="button"
                    onClick={() => setShowAddCardModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white font-medium hover:opacity-90 transition"
                    style={{ borderRadius: '12px' }}
                  >
                    הוסף כרטיס
                    <CreditCardIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Saved Cards List - Simple text format */}
                {paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {/* Sort by isPrimary first, then createdAt desc within each group. The
                        actual DB isPrimary flag is the source of truth — index === 0 is the
                        primary card, everything else is "saved". */}
                    {[...paymentMethods]
                      .sort((a, b) =>
                        Number(b.isPrimary) - Number(a.isPrimary)
                        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )
                      .map((method, index) => (
                      <div key={method.id} className="flex items-center justify-between p-4 rounded-xl border" style={{ backgroundColor: index === 0 ? 'white' : '#F4F4F5', borderColor: index === 0 ? '#D0D0D4' : '#E1E1E2' }}>
                        <div className="flex items-center gap-3" style={{ color: '#3F3F46' }}>
                          {/* Radio-style dot - clickable for non-primary cards */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (index === 0) return; // Already primary
                              if (!user) return;
                              setSettingPrimaryId(method.id);
                              try {
                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods/${method.id}/set-primary`, {
                                  method: 'PATCH',
                                });
                                if (!res.ok) throw new Error('Failed to set primary');
                                // Flip isPrimary locally — the new sort relies on this flag,
                                // so just bumping createdAt would no longer move the card.
                                setPaymentMethods(prev => prev.map(m => ({
                                  ...m,
                                  isPrimary: m.id === method.id,
                                })));
                                setMessage('הכרטיס הוגדר כראשי');
                                setMessageType('success');
                              } catch {
                                setMessage('לא ניתן להגדיר את הכרטיס כראשי כעת');
                                setMessageType('error');
                              } finally {
                                setSettingPrimaryId(null);
                              }
                            }}
                            disabled={settingPrimaryId === method.id}
                            className="flex items-center justify-center transition cursor-pointer"
                            style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', borderRadius: '50%', border: '2px solid', borderColor: index === 0 ? 'black' : '#D0D0D4' }}
                          >
                            {settingPrimaryId === method.id ? (
                              <div className="border-2 border-t-transparent animate-spin" style={{ width: '12px', height: '12px', borderRadius: '50%', borderColor: '#A1A1AA' }}></div>
                            ) : index === 0 ? (
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'black' }}></div>
                            ) : null}
                          </button>
                          <div>
                            <span className="font-medium">{index === 0 ? 'כרטיס ראשי:' : 'כרטיס שמור:'}</span>
                            <span className="mr-2">{method.cardBrand || 'Visa'} ************{method.cardLastFour}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Delete button - only show on non-primary cards (index !== 0).
                              Primary-card protection: to delete the primary, user must
                              first promote another card via the radio dot. */}
                          {paymentMethods.length >= 2 && index !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (method.inUseCommunities && method.inUseCommunities.length > 0) {
                                  setCardBlocked({
                                    cardBrand: method.cardBrand || 'Visa',
                                    cardLastFour: method.cardLastFour,
                                    communityNames: method.inUseCommunities,
                                  });
                                } else {
                                  setCardToDelete({
                                    id: method.id,
                                    cardBrand: method.cardBrand || 'Visa',
                                    cardLastFour: method.cardLastFour,
                                  });
                                }
                              }}
                              className="flex items-center gap-1 text-sm transition"
                              style={{ color: '#B3261E' }}
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                              הסר
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 rounded-xl border" style={{ backgroundColor: '#F4F4F5', borderColor: '#E1E1E2' }}>
                    <HiOutlineCreditCard className="w-12 h-12 mx-auto mb-4" style={{ color: '#D0D0D4' }} />
                    <p className="mb-2" style={{ color: '#71717A' }}>אין כרטיסים שמורים</p>
                    <p className="text-sm" style={{ color: '#A1A1AA' }}>הוסף כרטיס אשראי לתשלומים מהירים</p>
                  </div>
                )}

                {/* Security Note */}
                <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: '#91DCED' }}>
                  <LockIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold" style={{ fontSize: '18px', color: '#000000' }}>מאובטח ומוצפן</h4>
                    <p className="mt-1" style={{ fontSize: '16px', color: '#000000' }}>
                      פרטי התשלום שלך מוגנים בהצפנה מתקדמת ועומדים בסטנדרטים הגבוהים ביותר.
מספר הכרטיס המלא אינו נשמר במערכות שלנו.
                    </p>
                  </div>
                </div>

                {/* My Memberships */}
                <div
                  className="space-y-4 p-6 rounded-xl border"
                  style={{ borderColor: '#D0D0D4', backgroundColor: 'white' }}
                >
                  <div>
                    <h2 className="font-semibold" style={{ fontSize: '18px', color: '#000000' }}>המנויים שלי</h2>
                    <p style={{ fontSize: '16px', color: '#3F3F46' }}>קהילות בניהולך או כאלו שהצטרפת אליהן</p>
                  </div>
                  {memberships.length > 0 ? (
                    <div className="space-y-3">
                      {memberships.map((m) => {
                        const branch =
                          m.role === 'OWNER'
                            ? m.subscriptionStatus === 'SUSPENDED'
                              ? 'owner-suspended'
                              : m.subscriptionCancelledAt
                                ? 'owner-pending'
                                : 'owner-active'
                            : m.isPaid
                              ? 'paid-member'
                              : 'free-member';

                        let statusText = '';
                        if (branch === 'free-member' && m.joinedAt) {
                          statusText = `חבר קהילה מאז ${formatHebrewDate(m.joinedAt)}`;
                        } else if (branch === 'paid-member' && m.nextBillDate) {
                          statusText = `החיוב הבא ב-${formatHebrewDate(m.nextBillDate)}`;
                        } else if (branch === 'owner-active' && m.nextBillDate) {
                          statusText = `החיוב הבא ב-${formatHebrewDate(m.nextBillDate)}`;
                        } else if (branch === 'owner-pending' && m.effectiveEndDate) {
                          statusText = `המנוי יסתיים ב-${formatHebrewDate(m.effectiveEndDate)}`;
                        } else if (branch === 'owner-suspended' && m.suspendedAt) {
                          statusText = `המנוי הסתיים ב-${formatHebrewDate(m.suspendedAt)}`;
                        }

                        const priceLabel =
                          branch === 'free-member' ? 'חינם' : `₪${m.price} / חודש`;

                        return (
                          <div
                            key={m.communityId}
                            className="flex items-center justify-between p-4 rounded-xl border"
                            style={{ borderColor: '#D0D0D4', backgroundColor: 'white' }}
                          >
                            <Link
                              href={`/communities/${m.slug ?? m.communityId}/feed`}
                              className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition"
                            >
                              {m.logo ? (
                                <img
                                  src={getImageUrl(m.logo) ?? ''}
                                  alt={m.name}
                                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center"
                                  style={{ backgroundColor: '#E1E1E2', color: '#71717A', fontSize: '18px', fontWeight: 600 }}
                                >
                                  {m.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <h3 className="font-semibold truncate" style={{ fontSize: '18px', color: '#000000' }}>{m.name}</h3>
                                {statusText && (
                                  <p className="font-normal" style={{ fontSize: '16px', color: '#000000' }}>{statusText}</p>
                                )}
                              </div>
                            </Link>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="font-semibold" style={{ fontSize: '18px', color: '#000000' }}>{priceLabel}</span>
                              {branch === 'free-member' && (
                                <button
                                  type="button"
                                  onClick={() => setCommunityToLeaveFree(m)}
                                  className="font-normal underline hover:opacity-70 transition"
                                  style={{ fontSize: '16px', color: '#000000' }}
                                >
                                  עזוב קהילה
                                </button>
                              )}
                              {branch === 'paid-member' && (
                                <button
                                  type="button"
                                  onClick={() => setCommunityToLeavePaid(m)}
                                  className="font-normal underline hover:opacity-70 transition"
                                  style={{ fontSize: '16px', color: '#000000' }}
                                >
                                  בטל מנוי
                                </button>
                              )}
                              {branch === 'owner-active' && (
                                <button
                                  type="button"
                                  onClick={() => setCommunityToCancelSub(m)}
                                  className="font-normal underline hover:opacity-70 transition"
                                  style={{ fontSize: '16px', color: '#000000' }}
                                >
                                  בטל מנוי
                                </button>
                              )}
                              {branch === 'owner-pending' && (
                                <button
                                  type="button"
                                  disabled={undoingId === m.communityId}
                                  onClick={async () => {
                                    setUndoingId(m.communityId);
                                    try {
                                      const res = await fetch(
                                        `${process.env.NEXT_PUBLIC_API_URL}/communities/${m.communityId}/payment`,
                                        {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ subscriptionCancelledAt: null }),
                                        },
                                      );
                                      if (res.ok) {
                                        setMemberships((prev) =>
                                          prev.map((x) =>
                                            x.communityId === m.communityId
                                              ? { ...x, subscriptionCancelledAt: null, effectiveEndDate: null }
                                              : x,
                                          ),
                                        );
                                        setMessage('השבתת המנוי בוטלה.');
                                        setMessageType('success');
                                      } else {
                                        setMessage('שגיאה בביטול ההשבתה');
                                        setMessageType('error');
                                      }
                                    } catch {
                                      setMessage('שגיאה בביטול ההשבתה');
                                      setMessageType('error');
                                    } finally {
                                      setUndoingId(null);
                                    }
                                  }}
                                  className="font-normal underline hover:opacity-70 transition disabled:opacity-50"
                                  style={{ fontSize: '16px', color: '#000000' }}
                                >
                                  {undoingId === m.communityId ? 'מבטל...' : 'ביטול השבתה'}
                                </button>
                              )}
                              {branch === 'owner-suspended' && (
                                <button
                                  type="button"
                                  onClick={() => setCommunityToRenew(m)}
                                  className="font-normal underline hover:opacity-70 transition"
                                  style={{ fontSize: '16px', color: '#000000' }}
                                >
                                  חדש מנוי
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 rounded-xl border" style={{ backgroundColor: '#F4F4F5', borderColor: '#E1E1E2' }}>
                      <p style={{ color: '#71717A', fontSize: '16px' }}>אינך חבר באף קהילה כרגע</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Leave free community modal */}
            <LeaveCommunityModal
              isOpen={!!communityToLeaveFree}
              onClose={() => setCommunityToLeaveFree(null)}
              communityName={communityToLeaveFree?.name ?? ''}
              isLeaving={leavingCommunityId === communityToLeaveFree?.communityId}
              onConfirm={async () => {
                if (!communityToLeaveFree) return;
                const id = communityToLeaveFree.communityId;
                setLeavingCommunityId(id);
                try {
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/communities/${id}/leave`,
                    { method: 'POST' },
                  );
                  if (res.ok) {
                    setMemberships((prev) => prev.filter((x) => x.communityId !== id));
                    setCommunityToLeaveFree(null);
                    setMessage('עזבת את הקהילה בהצלחה');
                    setMessageType('success');
                  } else {
                    setMessage('שגיאה בעזיבת הקהילה');
                    setMessageType('error');
                  }
                } catch {
                  setMessage('שגיאה בעזיבת הקהילה');
                  setMessageType('error');
                } finally {
                  setLeavingCommunityId(null);
                }
              }}
            />

            {/* Leave paid community — same shared modal in paid variant. UI only;
                the auto-leave-at-period-end logic is gated on HYP integration
                (HYP follow-up #10). For now onConfirm just shows a message. */}
            <LeaveCommunityModal
              isPaid
              isOpen={!!communityToLeavePaid}
              onClose={() => setCommunityToLeavePaid(null)}
              communityName={communityToLeavePaid?.name ?? ''}
              effectiveDate={
                communityToLeavePaid?.nextBillDate
                  ? new Date(communityToLeavePaid.nextBillDate)
                  : new Date()
              }
              isLeaving={false}
              onConfirm={() => {
                setCommunityToLeavePaid(null);
                setMessage('ביטול מנוי בתשלום זמין רק לאחר חיבור מערכת התשלומים');
                setMessageType('error');
              }}
            />

            {/* Cancel owner subscription modal */}
            {communityToCancelSub && (
              <CancelSubscriptionModal
                isOpen
                onClose={() => setCommunityToCancelSub(null)}
                communityId={communityToCancelSub.communityId}
                effectiveDate={
                  communityToCancelSub.nextBillDate
                    ? new Date(communityToCancelSub.nextBillDate)
                    : new Date()
                }
                isPaidCommunity={communityToCancelSub.isPaid}
                paidMembersCount={communityToCancelSub.paidMembersCount ?? 0}
                onSuccess={(eff) => {
                  const id = communityToCancelSub.communityId;
                  setMemberships((prev) =>
                    prev.map((x) =>
                      x.communityId === id
                        ? { ...x, subscriptionCancelledAt: eff.toISOString(), effectiveEndDate: eff.toISOString(), nextBillDate: null }
                        : x,
                    ),
                  );
                  setCommunityToCancelSub(null);
                  setMessage('המנוי בוטל בהצלחה');
                  setMessageType('success');
                }}
                onError={() => {
                  setMessage('שגיאה בביטול המנוי');
                  setMessageType('error');
                  setCommunityToCancelSub(null);
                }}
              />
            )}

            {/* Renew suspended-community subscription via card update.
                Iframe flow (Phase 3.2) — on success the parent window
                redirects to /communities/<id>/manage?card=updated and the
                manage page handles the toast/refetch. Memberships shown on
                this page will reflect the new state on next /settings visit. */}
            {communityToRenew && (
              <UpdateCardModal
                isOpen
                onClose={() => setCommunityToRenew(null)}
                communityId={communityToRenew.communityId}
                wasSuspended
                amount={communityToRenew.price ?? 1}
              />
            )}

            {/* Add Card Modal - styled like pay popups with live validation */}
            {showAddCardModal && user && (
              <HypPaymentIframeModal
                amount={1}
                j5="J2"
                bof
                orderPrefix="tokenize-cardOnFile"
                clientName={userProfile?.name || user.email}
                email={user.email}
                userId={user.userId}
                onClose={() => setShowAddCardModal(false)}
              />
            )}

            {/* Message Display — inline, just below the active tab card */}
            {message && (
              <div
                ref={messageRef}
                className="mt-6 p-4 rounded-lg"
                style={messageType === 'error'
                  ? { backgroundColor: '#FEF2F2', color: '#B3261E', border: '1px solid #FECACA' }
                  : { backgroundColor: '#A7EA7B', color: 'black', fontSize: '16px', fontWeight: 400 }
                }
              >
                {message}
              </div>
            )}
          </form>

          {activeTab === 'profile' && (
            <StickySaveBar
              visible={hasUnsavedChanges()}
              saving={saving}
              onSave={() => handleSubmit()}
              onCancel={handleResetProfile}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {cardToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white p-6"
            style={{ borderRadius: '16px', width: 'fit-content', minWidth: '380px', maxWidth: 'min(90vw, 640px)' }}
            dir="rtl"
          >
            <div className="text-center">
              <h3 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>להסיר את הכרטיס?</h3>
              <p className="mb-4" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                {cardToDelete.cardBrand} ****{cardToDelete.cardLastFour} יוסר מהחשבון שלך.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setCardToDelete(null)}
                  disabled={deletingCardId === cardToDelete.id}
                  className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
                >
                  חזרה
                </button>
                <button
                  onClick={async () => {
                    if (!user) return;
                    const target = cardToDelete;
                    setDeletingCardId(target.id);
                    try {
                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods/${target.id}`, {
                        method: 'DELETE',
                      });
                      // Defense-in-depth: if a community started using this card
                      // between the page load and this click, the server still
                      // returns 409 with the community names. Handle that.
                      if (res.status === 409) {
                        const body = await res.json().catch(() => null);
                        const names: string[] = body?.communities ?? [];
                        if (names.length > 0) {
                          setCardBlocked({
                            cardBrand: target.cardBrand,
                            cardLastFour: target.cardLastFour,
                            communityNames: names,
                          });
                          setCardToDelete(null);
                          return;
                        }
                      }
                      if (!res.ok) throw new Error('Failed to delete');
                      setPaymentMethods(prev => prev.filter(m => m.id !== target.id));
                      setMessage('הכרטיס הוסר בהצלחה');
                      setMessageType('success');
                      setCardToDelete(null);
                    } catch {
                      setMessage('שגיאה בהסרת הכרטיס');
                      setMessageType('error');
                    } finally {
                      setDeletingCardId(null);
                    }
                  }}
                  disabled={deletingCardId === cardToDelete.id}
                  className="bg-error text-white hover:opacity-90 transition disabled:opacity-50"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
                >
                  {deletingCardId === cardToDelete.id ? 'מוחק...' : 'הסרת הכרטיס'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cardBlocked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white p-6"
            style={{ borderRadius: '16px', width: 'fit-content', minWidth: '380px', maxWidth: 'min(90vw, 640px)' }}
            dir="rtl"
          >
            <div className="text-center">
              <h3 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>אי אפשר להסיר את הכרטיס</h3>
              <p className="mb-2 text-right" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                הכרטיס הזה מחויב בקהילות הבאות:
              </p>
              <ul className="mb-4 text-right" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                {cardBlocked.communityNames.map((name) => (
                  <li key={name}>
                    <span style={{ fontSize: '18px', marginInlineEnd: '10px' }}>•</span>{name}
                  </li>
                ))}
              </ul>
              <p className="mb-4 text-right" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                יש לבטל את המנויים או להחליף את אמצעי התשלום לפני הסרת הכרטיס.
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => setCardBlocked(null)}
                  className="bg-black text-white hover:opacity-90 transition"
                  style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
                >
                  הבנתי
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (() => {
        // Show the paid-subscriptions warning when the user has any active
        // billing relationship: owns any community (pays Withly) or is a
        // member of a paid community (pays the community owner). Pre-HYP
        // these are placeholders; once real billing exists this still works.
        const hasActiveSubscriptions = memberships.some(
          (m) => m.role === 'OWNER' || m.isPaid,
        );
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white p-5"
              style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 520px)' }}
              dir="rtl"
            >
              <div className="text-center">
                <h3 className="font-semibold text-black mb-2" style={{ fontSize: '21px' }}>
                  למחוק את החשבון לצמיתות?
                </h3>
                <p className="mb-2" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                  זוהי פעולה בלתי הפיכה. כל נתוני החשבון, הקהילות והפעילות שלך יימחקו לצמיתות ללא אפשרות שחזור.
                </p>
                {hasActiveSubscriptions && (
                  <>
                    <p className="mb-1 font-semibold" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                      לתשומת הלב — קיימים בחשבון מנויים פעילים בתשלום.
                    </p>
                    <p className="mb-2" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                      מחיקת החשבון תביא לביטול מיידי של כלל המנויים הללו. הגישה לקהילות תיחסם, וחיובים שבוצעו בעבר לא יוחזרו.
                    </p>
                  </>
                )}
                <p className="mb-3" style={{ fontSize: '18px', color: 'var(--color-gray-10)' }}>
                  להמשך הפעולה, יש להקליד <strong>&quot;מחיקת החשבון שלי&quot;</strong> בשדה למטה:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="להקליד כאן"
                  className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 text-sm mb-3 text-right"
                  style={{ borderColor: '#E1E1E2' }}
                />
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className="bg-white text-black border hover:bg-gray-50 transition"
                    style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount || deleteConfirmText !== 'מחיקת החשבון שלי'}
                    className="bg-error text-white hover:opacity-90 transition disabled:opacity-50"
                    style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
                  >
                    {deletingAccount ? 'מוחק...' : 'מחיקת החשבון לצמיתות'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
