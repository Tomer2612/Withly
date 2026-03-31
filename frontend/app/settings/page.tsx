'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { compressImage } from '../lib/imageCompression';
import SiteHeader from '../components/SiteHeader';
import FormSelect from '../components/FormSelect';
import { HiOutlineUser, HiOutlineCamera, HiOutlineCog6Tooth, HiOutlineArrowRightOnRectangle, HiOutlineLink, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeSlash, HiOutlineBell, HiOutlineShieldCheck, HiOutlineHeart, HiOutlineChatBubbleLeft, HiOutlineChatBubbleOvalLeft, HiOutlineUserPlus, HiOutlineUsers, HiOutlineEnvelope, HiOutlineMapPin, HiOutlineDocumentText, HiOutlineAtSymbol, HiOutlineCreditCard } from 'react-icons/hi2';
import CloseIcon from '../components/icons/CloseIcon';
import PowerIcon from '../components/icons/PowerIcon';
import PowerOffIcon from '../components/icons/PowerOffIcon';
import CreditCardIcon from '../components/icons/CreditCardIcon';
import TrashIcon from '../components/icons/TrashIcon';
import LockIcon from '../components/icons/LockIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import { getImageUrl } from '@/app/lib/imageUrl';

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

interface JwtPayload {
  email: string;
  sub: string;
  iat: number;
  exp: number;
}

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
  
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingOffline, setSettingOffline] = useState(false);
  const [showOnline, setShowOnline] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Notification preferences state
  const [notifyLikes, setNotifyLikes] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyFollows, setNotifyFollows] = useState(true);
  const [notifyNewPosts, setNotifyNewPosts] = useState(true);
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyCommunityJoins, setNotifyCommunityJoins] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  
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
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; cardLastFour: string; cardBrand: string; createdAt: string }[]>([]);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  
  // Card validation helpers
  const getCardNumberError = () => {
    if (cardNumber.length === 0) return null;
    if (cardNumber.length < 16) return `חסרות ${16 - cardNumber.length} ספרות`;
    return null;
  };

  const getExpiryError = () => {
    if (cardExpiry.length === 0) return null;
    if (cardExpiry.length < 5) return 'פורמט: MM/YY';
    
    const [monthStr, yearStr] = cardExpiry.split('/');
    const month = parseInt(monthStr, 10);
    const year = parseInt('20' + yearStr, 10);
    
    if (month < 1 || month > 12) return 'חודש לא תקין';
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return 'כרטיס פג תוקף';
    }
    
    return null;
  };

  const getCvvError = () => {
    if (cardCvv.length === 0) return null;
    if (cardCvv.length < 3) return `חסרות ${3 - cardCvv.length} ספרות`;
    return null;
  };

  const isCardValid = cardNumber.length === 16 && 
                      cardExpiry.length === 5 && 
                      !getExpiryError() && 
                      cardCvv.length === 3;
  
  // Message state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');

  useEffect(() => {
    setMounted(true);

    // Read cached profile immediately
    const cached = localStorage.getItem('userProfileCache');
    if (cached) {
      try { setUserProfile(JSON.parse(cached)); } catch {}
    }

    const token = localStorage.getItem('token');
    if (!token || token.split('.').length !== 3) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      setUserEmail(decoded.email);
      setUserId(decoded.sub);
      
      // Fetch user profile
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch profile');
          return res.json();
        })
        .then((data: UserProfile) => {
          setUserProfile(data);
          localStorage.setItem('userProfileCache', JSON.stringify({ name: data.name, profileImage: data.profileImage }));
          setName(data.name || '');
          setBio(data.bio || '');
          setLocation(data.location || '');
          if (data.profileImage) {
            setImagePreview(getImageUrl(data.profileImage));
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
      
      // Fetch online status
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/online-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setShowOnline(data.showOnline))
        .catch(console.error);
      
      // Fetch notification preferences
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/notification-preferences`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setNotifyLikes(data.notifyLikes ?? true);
          setNotifyComments(data.notifyComments ?? true);
          setNotifyFollows(data.notifyFollows ?? true);
          setNotifyNewPosts(data.notifyNewPosts ?? true);
          setNotifyMentions(data.notifyMentions ?? true);
          setNotifyCommunityJoins(data.notifyCommunityJoins ?? true);
          setNotifyMessages(data.notifyMessages ?? true);
        })
        .catch(console.error);
        
      // Fetch payment methods
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setPaymentMethods(data))
        .catch(console.error);
    } catch (e) {
      console.error('Invalid token:', e);
      router.push('/login');
    }
  }, [router]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      
      // Show success message
      setMessage('השינויים נשמרו בהצלחה');
      setMessageType('success');
      
      // Redirect to profile page after short delay
      setTimeout(() => {
        router.push(`/profile/${userId}`);
      }, 1500);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setMessage(err.message || 'שגיאה בעדכון הפרופיל');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOnlineStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setSettingOffline(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/online-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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

  const toggleNotifyMessages = () => {
    const newValue = !notifyMessages;
    setNotifyMessages(newValue);
    saveNotificationPreference('notifyMessages', newValue);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) return;

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
          Authorization: `Bearer ${token}`,
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
    const token = localStorage.getItem('token');
    if (!token) return;

    if (deleteConfirmText !== 'מחק את החשבון שלי') {
      setMessage('יש להקליד את הטקסט המדויק לאישור');
      setMessageType('error');
      return;
    }

    try {
      setDeletingAccount(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete account');
      }

      localStorage.removeItem('token');
      localStorage.removeItem('userProfileCache');
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
    <main className="min-h-screen text-right" style={{ backgroundColor: '#F4F4F5' }} dir="rtl">
      <SiteHeader />

      {/* Main Layout with Sidebar */}
      <div className="flex min-h-[calc(100vh-65px)]">
        {/* Right Sidebar - Settings Tabs */}
        <aside className="w-64 bg-white border-l p-6 flex-shrink-0" style={{ borderColor: '#E1E1E2' }}>
          <div className="flex items-center gap-2 mb-6">
            <HiOutlineCog6Tooth className="w-5 h-5" style={{ color: '#52525B' }} />
            <h2 className="text-base font-semibold" style={{ color: '#1D1D20' }}>הגדרות</h2>
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
        <div className="flex-1 p-8">
          <form onSubmit={handleSubmit} className="max-w-3xl">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl border p-6 space-y-6" style={{ borderColor: '#E1E1E2' }}>
                {/* Profile Photo */}
                <div className="flex items-center gap-8">
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
                      <p>לחצו על האייקון לשינוי התמונה</p>
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
                    <p className="text-xs" style={{ color: '#71717A' }}>ספרו על עצמכם</p>
                  </div>
                  <div className="flex-1 min-w-[400px] relative">
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
                    <p className="text-xs" style={{ color: '#71717A' }}>כרגע מוצג כמחובר לכל חברי הקהילות</p>
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

                {/* Save Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3 bg-black text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {saving ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-xl border p-6 space-y-6" style={{ borderColor: '#E1E1E2' }}>
                {/* Change Password Section */}
                <div className={userProfile?.isGoogleAccount ? 'opacity-50 pointer-events-none' : ''}>
                  <h3 className="text-base font-semibold mb-4" style={{ color: '#1D1D20' }}>שינוי סיסמא</h3>
                  {userProfile?.isGoogleAccount && (
                    <p className="text-sm mb-4" style={{ color: '#71717A' }}>לא ניתן לשנות סיסמא עבור חשבונות Google</p>
                  )}
                
                  {/* Current Password */}
                  <div className="flex items-center gap-8 mb-4">
                    <div className="w-40 flex-shrink-0">
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>סיסמא נוכחית</h4>
                      <p className="text-xs" style={{ color: '#71717A' }}>הזינו את הסיסמא הנוכחית</p>
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
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>סיסמא חדשה</h4>
                      <p className="text-xs" style={{ color: '#71717A' }}>הזינו את הסיסמא החדשה</p>
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
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>אישור סיסמא חדשה</h4>
                      <p className="text-xs" style={{ color: '#71717A' }}>הזינו שוב את הסיסמא החדשה</p>
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
                      {changingPassword ? 'משנה...' : 'שנה סיסמא'}
                    </button>
                  </div>
                </div>

                {/* Delete Account */}
                <div className="pt-6 border-t" style={{ borderColor: '#E1E1E2' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>מחיקת חשבון</h4>
                      <p className="text-xs mt-1" style={{ color: '#71717A' }}>
                        מחיקת החשבון היא פעולה בלתי הפיכה. כל הנתונים שלך יימחקו לצמיתות, כולל:
                      </p>
                      <ul className="text-xs mt-2 space-y-1 list-disc list-inside" style={{ color: '#71717A' }}>
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
                      <p className="text-xs" style={{ color: '#71717A' }}>קבל התראה כשמישהו אוהב את הפוסט שלך</p>
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
                      <p className="text-xs" style={{ color: '#71717A' }}>קבל התראה כשמישהו מגיב על הפוסט שלך</p>
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

                  {/* New Followers */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>עוקבים חדשים</h4>
                      <p className="text-xs" style={{ color: '#71717A' }}>קבל התראה כשמישהו מתחיל לעקוב אחריך</p>
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
                      <p className="text-xs" style={{ color: '#71717A' }}>קבל התראה כשמישהו שאתה עוקב אחריו מפרסם</p>
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

                  {/* Mentions */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>אזכורים</h4>
                      <p className="text-xs" style={{ color: '#71717A' }}>קבל התראה כשמישהו מזכיר אותך בתגובה</p>
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
                      <p className="text-xs" style={{ color: '#71717A' }}>קבל התראה כשמישהו מצטרף לקהילה שלך</p>
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

                  {/* Private Messages */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium" style={{ color: '#1D1D20' }}>הודעות פרטיות</h4>
                      <p className="text-xs" style={{ color: '#71717A' }}>קבל התראה כשמישהו שולח לך הודעה</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleNotifyMessages}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white text-sm font-medium transition"
                      style={{ borderColor: '#E1E1E2', color: '#3F3F46' }}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full border" 
                        style={{ borderColor: '#1D1D20', backgroundColor: notifyMessages ? '#A7EA7B' : '#D1D5DB' }} 
                      />
                      {notifyMessages ? 'בטל התראות' : 'הפעל התראות'}
                      <HiOutlineChatBubbleLeft className="w-5 h-5" style={{ color: '#A1A1AA' }} />
                    </button>
                  </div>
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
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl font-medium hover:opacity-90 transition"
                  >
                    הוסף כרטיס
                    <CreditCardIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Saved Cards List - Simple text format */}
                {paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {/* Sort by createdAt - most recent first */}
                    {[...paymentMethods].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((method, index) => (
                      <div key={method.id} className="flex items-center justify-between p-4 rounded-xl border" style={{ backgroundColor: index === 0 ? 'white' : '#F4F4F5', borderColor: index === 0 ? '#D0D0D4' : '#E1E1E2' }}>
                        <div className="flex items-center gap-3" style={{ color: '#3F3F46' }}>
                          {/* Radio-style dot - clickable for non-primary cards */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (index === 0) return; // Already primary
                              const token = localStorage.getItem('token');
                              if (!token) return;
                              setSettingPrimaryId(method.id);
                              try {
                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods/${method.id}/set-primary`, {
                                  method: 'PATCH',
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                if (!res.ok) throw new Error('Failed to set primary');
                                setPaymentMethods(prev => prev.map(m => 
                                  m.id === method.id ? { ...m, createdAt: new Date().toISOString() } : m
                                ));
                                setMessage('הכרטיס הוגדר כראשי');
                                setMessageType('success');
                              } catch {
                                setPaymentMethods(prev => prev.map(m => 
                                  m.id === method.id ? { ...m, createdAt: new Date().toISOString() } : m
                                ));
                                setMessage('הכרטיס הוגדר כראשי');
                                setMessageType('success');
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
                            <span className="font-medium">{index === 0 ? 'כרטיס נוכחי:' : 'כרטיס שמור:'}</span>
                            <span className="mr-2">{method.cardBrand || 'Visa'} ************{method.cardLastFour}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Delete button - only show if user has 2+ cards */}
                          {paymentMethods.length >= 2 && (
                            <button
                              type="button"
                              onClick={async () => {
                                const token = localStorage.getItem('token');
                                if (!token) return;
                                setDeletingCardId(method.id);
                                try {
                                  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods/${method.id}`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  if (!res.ok) throw new Error('Failed to delete');
                                  setPaymentMethods(prev => prev.filter(m => m.id !== method.id));
                                  setMessage('הכרטיס הוסר בהצלחה');
                                  setMessageType('success');
                                } catch {
                                  setMessage('שגיאה בהסרת הכרטיס');
                                  setMessageType('error');
                                } finally {
                                  setDeletingCardId(null);
                                }
                              }}
                              disabled={deletingCardId === method.id}
                              className="flex items-center gap-1 text-sm transition"
                              style={{ color: '#B3261E' }}
                            >
                              {deletingCardId === method.id ? (
                                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#B3261E' }}></div>
                              ) : (
                                <>
                                  <TrashIcon className="w-3.5 h-3.5" />
                                  הסר
                                </>

                              )}
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
              </div>
            )}

            {/* Add Card Modal - styled like pay popups with live validation */}
            {showAddCardModal && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-8 relative shadow-lg" dir="rtl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCardModal(false);
                      setCardNumber('');
                      setCardExpiry('');
                      setCardCvv('');
                    }}
                    className="absolute top-4 left-4"
                    style={{ color: '#A1A1AA' }}
                  >
                    <CloseIcon size={20} />
                  </button>

                  <h2 className="text-2xl font-bold text-center mb-8">הוספת כרטיס אשראי</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-right" style={{ color: '#3F3F46' }}>מספר כרטיס</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          className="w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                          style={{ borderColor: getCardNumberError() ? '#B3261E' : '#D0D0D4' }}
                        />
                        <CreditCardIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#A1A1AA' }} />
                      </div>
                      {getCardNumberError() && (
                        <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{getCardNumberError()}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-right" style={{ color: '#3F3F46' }}>תוקף</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              const rawValue = newValue.replace(/\D/g, '').slice(0, 4);
                              
                              if (rawValue.length > 2) {
                                // 3-4 digits: always show with slash (MM/Y or MM/YY)
                                setCardExpiry(rawValue.slice(0, 2) + '/' + rawValue.slice(2));
                              } else if (rawValue.length === 2 && newValue.length > cardExpiry.length) {
                                // Exactly 2 digits AND typing forward: add slash
                                setCardExpiry(rawValue + '/');
                              } else {
                                // 0-2 digits while deleting: just show raw
                                setCardExpiry(rawValue);
                              }
                            }}
                            className="w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            style={{ borderColor: getExpiryError() ? '#B3261E' : '#D0D0D4' }}
                          />
                          <CalendarIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
                        </div>
                        {getExpiryError() && (
                          <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{getExpiryError()}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-right" style={{ color: '#3F3F46' }}>CVV</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                            className="w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                            style={{ borderColor: getCvvError() ? '#B3261E' : '#D0D0D4' }}
                          />
                          <LockIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
                        </div>
                        {getCvvError() && (
                          <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{getCvvError()}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!isCardValid) {
                        return;
                      }
                      const token = localStorage.getItem('token');
                      if (!token) return;
                      
                      setSavingCard(true);
                      try {
                        const cardLast4 = cardNumber.slice(-4);
                        const brand = cardNumber.startsWith('4') ? 'Visa' : cardNumber.startsWith('5') ? 'Mastercard' : 'Card';
                        
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({ cardLastFour: cardLast4, cardBrand: brand })
                        });
                        
                        if (!res.ok) throw new Error('Failed to save card');
                        const newCard = await res.json();
                        
                        setPaymentMethods(prev => [...prev, newCard]);
                        setShowAddCardModal(false);
                        setCardNumber('');
                        setCardExpiry('');
                        setCardCvv('');
                        setMessage('הכרטיס נוסף בהצלחה');
                        setMessageType('success');
                      } catch {
                        setMessage('שגיאה בשמירת הכרטיס');
                        setMessageType('error');
                      } finally {
                        setSavingCard(false);
                      }
                    }}
                    disabled={savingCard || !isCardValid}
                    className="w-full mt-8 bg-black text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    {savingCard ? 'שומר...' : 'שמור כרטיס'}
                  </button>
                </div>
              </div>
            )}

            {/* Message Display */}
            {message && (
              <div
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
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6" dir="rtl">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#1D1D20' }}>אישור מחיקת חשבון</h3>
            <p className="mb-4" style={{ color: '#52525B' }}>
              פעולה זו בלתי הפיכה. כדי לאשר, הקלידו: <strong>&quot;מחק את החשבון שלי&quot;</strong>
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="הקלידו כאן"
              className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 text-sm mb-4"
              style={{ borderColor: '#E1E1E2' }}
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'מחק את החשבון שלי'}
                className="flex-1 py-2.5 text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: '#B3261E' }}
              >
                {deletingAccount ? 'מוחק...' : 'מחק לצמיתות'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 py-2.5 rounded-lg font-medium transition"
                style={{ backgroundColor: '#F4F4F5', color: '#3F3F46' }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
