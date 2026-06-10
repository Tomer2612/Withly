'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaYoutube, FaWhatsapp, FaFacebook, FaInstagram } from 'react-icons/fa';
import { compressImage, compressImages, MAX_IMAGE_SIZE_BYTES } from '../../../lib/imageCompression';
import { isValidVideoUrl, getVideoProvider, getProviderLabel, MAX_VIDEO_SIZE_BYTES } from '../../../lib/videoUtils';
import { useCommunityContext } from '../CommunityContext';
import { authFetch } from '../../../lib/auth';
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
import { HiOutlineCog6Tooth } from 'react-icons/hi2';
import CreditCardIcon from '../../../components/icons/CreditCardIcon';
import EditIcon from '../../../components/icons/EditIcon';
import LinkIcon from '../../../components/icons/LinkIcon';
import GlobeIcon from '../../../components/icons/GlobeIcon';
import ComingSoonTooltip from '../../../components/ComingSoonTooltip';
import CancelSubscriptionModal from '../../../components/CancelSubscriptionModal';
import UpdateCardModal from '../../../components/UpdateCardModal';
import { getImageUrl } from '@/app/lib/imageUrl';
import StickySaveBar from '../../../components/StickySaveBar';
import { useDefaultPlan } from '../../../lib/usePlan';

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
  // Cron-managed billing date — authoritative. Was being recomputed from
  // trialStartDate + planTrialLength via a local util pre-Phase-6.3; now
  // read directly from the backend.
  nextBillingDate: string | null;
  // Phase 6.3: card display fields read from the bound payment method
  // (was: denormalized cardLastFour/cardBrand columns on Community,
  // dropped in commit that ships this interface change).
  paymentMethod: { cardLastFour: string; cardBrand: string } | null;
  subscriptionCancelledAt: string | null;
}

const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};
const formatHebrewDate = (d: Date): string => d.toLocaleDateString('he-IL');
// Slash-style d/m/yyyy date format used in the revenue card (no leading zeros).
const formatSlashDate = (d: Date): string =>
  `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
// Trial-billing math now takes trialLengthMonths as a param so the plan
// driver (Plan.trialLengthMonths from /api/plans/default) is the only
// source of truth — no more module-level constants.
const getTrialEnd = (trialStart: Date | null, trialLengthMonths: number): Date | null =>
  trialStart ? addMonths(trialStart, trialLengthMonths) : null;
const isInTrial = (trialStart: Date | null, trialLengthMonths: number): boolean => {
  const end = getTrialEnd(trialStart, trialLengthMonths);
  return !!end && end > new Date();
};
// Phase 6.3: local trial-cycle math for "next billing" and "cancellation
// effective date" was deleted. Authoritative dates come from the backend:
//   - community.nextBillingDate (cron-managed)
//   - CancelSubscriptionModal fetches a /cancellation-preview endpoint that
//     factors in member periods (Phase 5 Mission 3)
// `getTrialEnd` + `isInTrial` stay since trial-end isn't a stored column
// (it's trialStartDate + plan.trialLengthMonths) and only the trial
// disclosure copy reads it.

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

  // Owner earnings summary from /communities/:id/earnings — this community's
  // plan (price/commission/trial) + ledger-derived lifetime figures.
  const [earnings, setEarnings] = useState<{
    commissionBasisPoints: number;
    monthlyPriceILS: number;
    trialLengthMonths: number;
    earnedToDateNet: number;
    totalRefunds: number;
  } | null>(null);

  // Plan-driven values for trial math + billing labels. Prefer THIS
  // community's plan (from the earnings endpoint); fall back to the default
  // plan for the first paint / before the fetch resolves.
  const defaultPlan = useDefaultPlan();
  const planTrialLength = earnings?.trialLengthMonths ?? defaultPlan?.trialLengthMonths ?? 1;
  const planMonthlyPrice = earnings?.monthlyPriceILS ?? defaultPlan?.monthlyPriceILS ?? 99;

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [community, setCommunity] = useState<Community | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Get user data from layout context
  const { userEmail, userId, isOwner, isOwnerOrManager, loading: contextLoading, community: contextCommunity, refreshCommunity } = useCommunityContext();
  const isSuspended = contextCommunity?.subscriptionStatus === 'SUSPENDED';
  
  // Slug
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  
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
  
  // Community status
  const [communityStatus, setCommunityStatus] = useState<'DRAFT' | 'PRIVATE' | 'PUBLIC'>('DRAFT');
  const [pendingStatus, setPendingStatus] = useState<'DRAFT' | 'PRIVATE' | 'PUBLIC' | null>(null);
  
  // Price
  const [price, setPrice] = useState<number>(10);
  const [isPaidCommunity, setIsPaidCommunity] = useState(false);
  
  // Trial and payment
  const [trialStartDate, setTrialStartDate] = useState<Date | null>(null);
  // Authoritative next-bill date from the cron. Replaces the local
  // getNextBillingDate() math (Phase 6.3).
  const [nextBillingDate, setNextBillingDate] = useState<Date | null>(null);
  const [cardLastFour, setCardLastFour] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [subscriptionCancelledAt, setSubscriptionCancelledAt] = useState<Date | null>(null);
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);
  const [undoingCancellation, setUndoingCancellation] = useState(false);
  // Pending community-price change announcement (owner sets new price; takes
  // effect for existing members 1 month later). Lives on Community.
  const [pendingPrice, setPendingPrice] = useState<number | null>(null);
  const [pendingPriceEffectiveAt, setPendingPriceEffectiveAt] = useState<Date | null>(null);
  const [priceChangeAnnouncedAt, setPriceChangeAnnouncedAt] = useState<Date | null>(null);
  const [showPriceChangeConfirmModal, setShowPriceChangeConfirmModal] = useState(false);
  const [announcingPrice, setAnnouncingPrice] = useState(false);
  // Server-stored price snapshot, separate from the editable `price` input.
  // Used for revenue calc and the recent-paid list so they don't twitch
  // while the owner is mid-edit (or while a change is pending).
  const [currentCommunityPrice, setCurrentCommunityPrice] = useState<number>(0);
  // Recent members for the "הכנסות הקהילה" card. Owner is filtered out client-side.
  const [recentMembers, setRecentMembers] = useState<Array<{ id: string; name: string; joinedAt: string }>>([]);
  // Totals for revenue calc — driven by the same /members fetch as recentMembers.
  const [totalPayingMembers, setTotalPayingMembers] = useState<number>(0);
  // Members who joined on/after the announcement date — they pay the new
  // (pending) price; the rest are grandfathered until the effective date.
  const [newPriceMembers, setNewPriceMembers] = useState<number>(0);
  // Owner earnings summary from /communities/:id/earnings — commission rate
  // (for the gross→net breakdown) + ledger-derived lifetime figures.

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
  const initialFormRef = useRef<{ name: string; description: string; topic: string; slug: string; rules: string[]; galleryVideos: string[]; youtubeUrl: string; whatsappUrl: string; facebookUrl: string; instagramUrl: string; price: number; isPaidCommunity: boolean; showOnlineMembers: boolean; communityStatus: string } | null>(null);

  // Pricing is owned entirely by the Payments tab's contextual button +
  // announcement popup, so it must NOT drive the floating bar (that's the
  // cross-tab leak). `includePricing` stays true for the navigation-away
  // guard, so leaving the page with an uncommitted price change still warns.
  const hasUnsavedChanges = (includePricing = true) => {
    const init = initialFormRef.current;
    if (!init) return false;
    const pricingChanged =
      price !== init.price || isPaidCommunity !== init.isPaidCommunity;
    return (
      name !== init.name ||
      description !== init.description ||
      topic !== init.topic ||
      slug !== init.slug ||
      JSON.stringify(rules) !== JSON.stringify(init.rules) ||
      JSON.stringify(galleryVideos) !== JSON.stringify(init.galleryVideos) ||
      youtubeUrl !== init.youtubeUrl ||
      whatsappUrl !== init.whatsappUrl ||
      facebookUrl !== init.facebookUrl ||
      instagramUrl !== init.instagramUrl ||
      showOnlineMembers !== init.showOnlineMembers ||
      communityStatus !== init.communityStatus ||
      images.some(img => !img.isExisting) ||
      galleryVideoFiles.length > 0 ||
      !!(logo && !logo.isExisting) ||
      (includePricing && pricingChanged)
    );
  };

  // Keep a ref in sync so stable closures can read latest value
  const shouldBlockRef = useRef(false);
  useEffect(() => {
    shouldBlockRef.current = hasUnsavedChanges();
  });

  // After the owner confirms a price change in the popup we re-fire the form
  // submit. This ref tells handleUpdateCommunity to skip the price-change
  // intercept and the FormData price field for that one re-entry.
  const skipPriceRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'rules' || tab === 'social' || tab === 'payments') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // When the subscription is suspended, force the owner onto Payments — the
  // other tabs are dimmed and edits would 403 server-side anyway.
  useEffect(() => {
    if (isSuspended && isOwner) {
      setActiveTab('payments');
    }
  }, [isSuspended, isOwner]);

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

  // Phase 3.2 + Phase 4 Mission 5 — after a community card update or
  // suspension-recovery attempt, the backend lands the user here with a
  // ?card=<status> param. Refresh community state, show the matching
  // toast, strip the query so a refresh doesn't replay.
  //
  // Param taxonomy (matches the backend's bind result):
  //   updated       = ACTIVE community, fresh card swap, no charge
  //   existing      = ACTIVE community, same card re-bound, no charge
  //   reactivated   = was SUSPENDED, recovery SOFT succeeded — community
  //                   back online, new monthly period started
  //   charge-failed = was SUSPENDED, recovery SOFT rejected — card is
  //                   still bound; community stays SUSPENDED; owner
  //                   can try again with a different card
  //   error         = generic error (tokenize failed, network blip)
  useEffect(() => {
    const cardStatus = searchParams.get('card');
    if (!cardStatus) return;
    if (cardStatus === 'updated') {
      refreshCommunity().catch(() => {});
      setActiveTab('payments');
      setMessage('אמצעי התשלום עודכן בהצלחה');
      setMessageType('success');
    } else if (cardStatus === 'existing') {
      refreshCommunity().catch(() => {});
      setActiveTab('payments');
      setMessage('הכרטיס כבר מקושר לקהילה זו');
      setMessageType('success');
    } else if (cardStatus === 'reactivated') {
      refreshCommunity().catch(() => {});
      setActiveTab('payments');
      setMessage('הקהילה חזרה לפעילות והחיוב בוצע בהצלחה');
      setMessageType('success');
    } else if (cardStatus === 'charge-failed') {
      refreshCommunity().catch(() => {});
      setActiveTab('payments');
      setMessage('החיוב לא עבר. הכרטיס נשמר, ניתן לנסות שוב או להשתמש בכרטיס אחר.');
      setMessageType('error');
    } else if (cardStatus === 'error') {
      setMessage('שגיאה בעדכון אמצעי התשלום. יש לנסות שוב.');
      setMessageType('error');
    }
    window.history.replaceState(null, '', window.location.pathname);
    // refreshCommunity intentionally omitted — capturing the function would
    // re-fire the effect every time it changes identity. We just want to
    // react when the search params change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch community details and check permissions
  useEffect(() => {
    const fetchCommunity = async () => {
      if (!communityId || !userId) return;
      
      // Wait for context to finish loading
      if (contextLoading) return;
      
      // Only owners and managers can access manage page (from context)
      if (!isOwnerOrManager) {
        router.push(`/communities/${communityId}/feed`);
        return;
      }
      
      try {
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
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
        setSlug(data.slug || communityId);
        setYoutubeUrl(data.youtubeUrl || '');
        setWhatsappUrl(data.whatsappUrl || '');
        setFacebookUrl(data.facebookUrl || '');
        setInstagramUrl(data.instagramUrl || '');
        setRules(data.rules || []);
        setPrice(data.price ?? 10);
        setIsPaidCommunity((data.price ?? 0) > 0);
        
        // Load trial and payment info
        if (data.trialStartDate) {
          setTrialStartDate(new Date(data.trialStartDate));
        } else {
          // If no trial start date, set it to community creation date (or now)
          setTrialStartDate(data.createdAt ? new Date(data.createdAt) : new Date());
        }
        setSubscriptionCancelledAt(data.subscriptionCancelledAt ? new Date(data.subscriptionCancelledAt) : null);
        setPendingPrice(typeof data.pendingPrice === 'number' ? data.pendingPrice : null);
        setPendingPriceEffectiveAt(data.pendingPriceEffectiveAt ? new Date(data.pendingPriceEffectiveAt) : null);
        setPriceChangeAnnouncedAt(data.priceChangeAnnouncedAt ? new Date(data.priceChangeAnnouncedAt) : null);
        setCurrentCommunityPrice(typeof data.price === 'number' ? data.price : 0);
        setCardLastFour(data.paymentMethod?.cardLastFour || null);
        setCardBrand(data.paymentMethod?.cardBrand || null);
        setNextBillingDate(data.nextBillingDate ? new Date(data.nextBillingDate) : null);
        setShowOnlineMembers(data.showOnlineMembers !== false);
        setCommunityStatus(data.status || 'DRAFT');
        
        // Store initial form values for unsaved changes detection
        initialFormRef.current = {
          name: data.name,
          description: data.description,
          topic: data.topic || '',
          slug: data.slug || communityId,
          rules: data.rules || [],
          galleryVideos: data.galleryVideos || [],
          youtubeUrl: data.youtubeUrl || '',
          whatsappUrl: data.whatsappUrl || '',
          facebookUrl: data.facebookUrl || '',
          instagramUrl: data.instagramUrl || '',
          price: data.price ?? 10,
          isPaidCommunity: (data.price ?? 0) > 0,
          showOnlineMembers: data.showOnlineMembers !== false,
          communityStatus: data.status || 'DRAFT',
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

        // Recent members for the "הכנסות הקהילה" card. Backend already
        // sorts by joinedAt desc and includes the owner — drop the owner
        // and take the last 4. Fire-and-forget; failure shouldn't break
        // the rest of the manage page.
        try {
          const membersRes = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/members`);
          if (membersRes.ok) {
            const all = await membersRes.json();
            // Sort purely by joinedAt desc (the API sorts by role first,
            // which would push managers above newer regular members).
            const onlyMembers: Array<{ id: string; name: string; joinedAt: string }> =
              (Array.isArray(all) ? all : [])
                .filter((m: { isOwner?: boolean }) => !m.isOwner)
                .sort((a: { joinedAt: string }, b: { joinedAt: string }) =>
                  new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime(),
                )
                .map((m: { id: string; name: string; joinedAt: string }) => ({
                  id: m.id,
                  name: m.name,
                  joinedAt: m.joinedAt,
                }));
            setRecentMembers(onlyMembers.slice(0, 4));
            setTotalPayingMembers(onlyMembers.length);
            const announcedAt = data.priceChangeAnnouncedAt ? new Date(data.priceChangeAnnouncedAt) : null;
            setNewPriceMembers(
              announcedAt
                ? onlyMembers.filter(m => new Date(m.joinedAt) >= announcedAt).length
                : 0,
            );
          }
        } catch {
          // Non-fatal; the card just renders without the recent-paid list.
        }

        // Owner earnings (commission rate + ledger lifetime figures) for the
        // revenue card. Fire-and-forget; the card falls back to gross-only.
        try {
          const earningsRes = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/earnings`);
          if (earningsRes.ok) {
            setEarnings(await earningsRes.json());
          }
        } catch {
          // Non-fatal; card shows gross figures without the net breakdown.
        }
      } catch (err) {
        console.error('Error fetching community:', err);
        router.push('/');
      } finally {
        setPageLoading(false);
      }
    };

    fetchCommunity();
  }, [communityId, userId, router, contextLoading, isOwnerOrManager]);

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
          isPrimary: false,
          isExisting: false,
        };
        setImages(prev => {
          const updated = [...prev, newImage];
          // If no image is primary yet, make the first one primary
          if (!updated.some(img => img.isPrimary)) {
            updated[0] = { ...updated[0], isPrimary: true };
          }
          return updated;
        });
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

  // Revert all tracked fields to their last-saved values and stay on the
  // page. Scope matches hasUnsavedChanges() so the bar hides afterwards:
  // scalars + rules from the snapshot, drop unsaved media additions.
  const handleResetCommunity = () => {
    const init = initialFormRef.current;
    if (!init) return;
    setName(init.name);
    setDescription(init.description);
    setTopic(init.topic);
    setSlug(init.slug);
    setSlugError('');
    setRules(init.rules);
    setYoutubeUrl(init.youtubeUrl);
    setWhatsappUrl(init.whatsappUrl);
    setFacebookUrl(init.facebookUrl);
    setInstagramUrl(init.instagramUrl);
    // Pricing is intentionally NOT reverted here — it's owned by the
    // Payments popup's own ביטול, not the floating bar.
    setShowOnlineMembers(init.showOnlineMembers);
    setCommunityStatus(init.communityStatus as 'DRAFT' | 'PRIVATE' | 'PUBLIC');
    setImages(prev => prev.filter(img => img.isExisting));
    setGalleryVideos(init.galleryVideos);
    setGalleryVideoFiles([]);
    if (logo && !logo.isExisting) {
      setLogo(
        community?.logo
          ? { preview: getImageUrl(community.logo), isExisting: true, existingPath: community.logo }
          : null
      );
    }
    setMessage('');
  };

  // Re-fetch the community after a successful save and re-establish the
  // baseline (form state + snapshot + media as "existing"). This is what
  // makes the bar correctly hide post-save AND reappear on the next edit,
  // on every tab — replacing the old "null the snapshot" behaviour that
  // disabled change-detection until a page reload.
  const reloadCommunityBaseline = async () => {
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`);
      if (!res.ok) return;
      const data = await res.json();
      setCommunity(data);
      setName(data.name);
      setDescription(data.description);
      setTopic(data.topic || '');
      setSlug(data.slug || communityId);
      setYoutubeUrl(data.youtubeUrl || '');
      setWhatsappUrl(data.whatsappUrl || '');
      setFacebookUrl(data.facebookUrl || '');
      setInstagramUrl(data.instagramUrl || '');
      setRules(data.rules || []);
      setPrice(data.price ?? 10);
      setIsPaidCommunity((data.price ?? 0) > 0);
      setShowOnlineMembers(data.showOnlineMembers !== false);
      setCommunityStatus(data.status || 'DRAFT');
      // Payment / pending-price state — must mirror the initial load so a
      // scheduled change (e.g. paid→free announced) shows its pending banner
      // after save instead of appearing to revert to plain "paid".
      if (data.trialStartDate) {
        setTrialStartDate(new Date(data.trialStartDate));
      } else {
        setTrialStartDate(data.createdAt ? new Date(data.createdAt) : new Date());
      }
      setSubscriptionCancelledAt(data.subscriptionCancelledAt ? new Date(data.subscriptionCancelledAt) : null);
      setPendingPrice(typeof data.pendingPrice === 'number' ? data.pendingPrice : null);
      setPendingPriceEffectiveAt(data.pendingPriceEffectiveAt ? new Date(data.pendingPriceEffectiveAt) : null);
      setPriceChangeAnnouncedAt(data.priceChangeAnnouncedAt ? new Date(data.priceChangeAnnouncedAt) : null);
      setCurrentCommunityPrice(typeof data.price === 'number' ? data.price : 0);
      setCardLastFour(data.paymentMethod?.cardLastFour || null);
      setCardBrand(data.paymentMethod?.cardBrand || null);
      setNextBillingDate(data.nextBillingDate ? new Date(data.nextBillingDate) : null);
      setLogo(
        data.logo
          ? { preview: getImageUrl(data.logo), isExisting: true, existingPath: data.logo }
          : null
      );
      const loaded: ImageFile[] = [];
      if (data.image) {
        loaded.push({ preview: getImageUrl(data.image), isPrimary: true, isExisting: true, existingPath: data.image });
      }
      if (Array.isArray(data.galleryImages)) {
        data.galleryImages.forEach((p: string) =>
          loaded.push({ preview: getImageUrl(p), isPrimary: false, isExisting: true, existingPath: p })
        );
      }
      setImages(loaded);
      setGalleryVideos(Array.isArray(data.galleryVideos) ? data.galleryVideos : []);
      setGalleryVideoFiles([]);
      initialFormRef.current = {
        name: data.name,
        description: data.description,
        topic: data.topic || '',
        slug: data.slug || communityId,
        rules: data.rules || [],
        galleryVideos: Array.isArray(data.galleryVideos) ? data.galleryVideos : [],
        youtubeUrl: data.youtubeUrl || '',
        whatsappUrl: data.whatsappUrl || '',
        facebookUrl: data.facebookUrl || '',
        instagramUrl: data.instagramUrl || '',
        price: data.price ?? 10,
        isPaidCommunity: (data.price ?? 0) > 0,
        showOnlineMembers: data.showOnlineMembers !== false,
        communityStatus: data.status || 'DRAFT',
      };
    } catch {
      // Non-fatal: save already succeeded; worst case the bar lingers.
    }
  };

  // Payments has no save bar — the "עדכן מחיר" button on the pricing card
  // is the explicit trigger; this opens the announcement popup (the confirm
  // + commit). Called only from that button, with the current pricing state.
  const openPriceChangeIfChanged = (nextIsPaid: boolean, nextPrice: number) => {
    const init = initialFormRef.current;
    if (!init || !isOwner || pendingPriceEffectiveAt || showPriceChangeConfirmModal) return;
    // A paid price must be in range. This is where the ₪10–1000 check now
    // lives (the old handleUpdateCommunity guard isn't reached on Payments
    // anymore — there's no Save button).
    if (nextIsPaid && (nextPrice < 10 || nextPrice > 1000)) {
      setMessage('המחיר חייב להיות בין ₪10 ל-₪1000');
      setMessageType('error');
      return;
    }
    const effNext = nextIsPaid ? nextPrice : 0;
    const effInit = init.isPaidCommunity ? init.price : 0;
    if (effNext === effInit) return; // no net change — nothing to confirm
    setShowPriceChangeConfirmModal(true);
  };

  const handleUpdateCommunity = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!name.trim() || !description.trim()) {
      setMessage('יש למלא את כל שדות החובה');
      setMessageType('error');
      return;
    }

    // Slug is now saved by the floating Save (no separate button). Validate
    // and check availability up front so an invalid URL aborts the whole
    // save rather than half-applying it.
    const slugChanged = slug !== (community?.slug || communityId);
    if (slugChanged) {
      if (slug.trim().length < 3) {
        setSlugError('הכתובת חייבת להכיל לפחות 3 תווים');
        setActiveTab('general');
        return;
      }
      if (slug.length > 50) {
        setSlugError('הכתובת יכולה להכיל עד 50 תווים');
        setActiveTab('general');
        return;
      }
      const checkRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/communities/check-slug/${slug}?excludeId=${communityId}`
      );
      const checkData = await checkRes.json();
      if (!checkData.available) {
        setSlugError('הכתובת הזו כבר תפוסה');
        setActiveTab('general');
        return;
      }
      setSlugError('');
    }

    // Price is owned entirely by the Payments tab's announcement-popup flow
    // (openPriceChangeIfChanged → popup → announce-price). handleUpdateCommunity
    // never initiates a price change — so there's no interception here, and an
    // uncommitted pricing edit can't hijack a save from another tab.
    const skipPriceFieldThisSave = skipPriceRef.current;
    skipPriceRef.current = false;

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
      
      // Price — skip when an announcement is pending so we don't overwrite
      // the grandfathered current price. The pending price flips into place
      // server-side on the effective date (lazy flip in findById).
      // Also skip on the post-announce re-save so we don't undo what
      // announce-price just stored.
      // Always the last-saved price, never the uncommitted UI value — price
      // changes go only through announce-price, so this is a no-op for the
      // committed value and can't bypass the grandfather/rate-limit flow.
      if (!pendingPriceEffectiveAt && !skipPriceFieldThisSave) {
        const base = initialFormRef.current;
        const committedPrice = base && base.isPaidCommunity ? base.price : 0;
        formData.append('price', committedPrice.toString());
      }
      
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
      
      // Community status
      formData.append('status', communityStatus);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}`, {
        method: 'PUT',
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
        },
        body: JSON.stringify({ rules }),
      });

      if (!rulesRes.ok) {
        console.error('Failed to save rules');
      }

      // Slug, when changed — folded into the main Save.
      if (slugChanged) {
        const slugRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/slug`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        if (!slugRes.ok) {
          const errorData = await slugRes.json();
          throw new Error(errorData.message || 'Failed to update slug');
        }
      }

      setMessage('הקהילה עודכנה בהצלחה!');
      setMessageType('success');

      if (slugChanged) {
        // The slug is in the URL — navigate to the new path. The page
        // remounts and re-establishes its baseline from scratch.
        router.push(`/communities/${slug}/manage`);
      } else {
        // Always re-establish the baseline from the server — including the
        // price-change (announce) path. The toggle then reflects the current
        // (grandfathered) pricing + the pending banner, so post-save and
        // post-reload look identical (no optimistic divergence).
        await reloadCommunityBaseline();
      }
    } catch (err: any) {
      // Suppress the noisy console.error for known business rules — the UI
      // toast is the user-visible signal, no need to red-flag the console.
      const knownErrors: Record<string, string> = {
        CANNOT_DRAFT_WITH_MEMBERS:
          'לא ניתן להעביר למצב טיוטה כשיש חברים בקהילה. ניתן להעביר לפרטית או לבטל את המנוי.',
        PAYMENT_METHOD_REQUIRED:
          'יש להוסיף אמצעי תשלום לפני פרסום הקהילה.',
      };
      const friendly = knownErrors[err?.message];
      if (!friendly) {
        console.error('Community update error:', err);
      }
      setMessage(friendly ?? err.message ?? 'שגיאה בעדכון הקהילה');
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

  // Revenue card figures. Monthly income is the forward-looking projection
  // (paying members × price, with grandfathered vs. new-price members) —
  // shown gross; the commission is surfaced as a rate in the billing panel
  // rather than mixed into this number. bps falls back to the default plan
  // until the earnings fetch resolves.
  const grossMonthly =
    (totalPayingMembers - newPriceMembers) * currentCommunityPrice +
    newPriceMembers * (pendingPrice ?? currentCommunityPrice);
  const commissionBps = earnings?.commissionBasisPoints ?? defaultPlan?.commissionBasisPoints ?? 0;
  // "940" → "9.4", "500" → "5" (drop a trailing .0 so round rates read clean).
  const commissionRateLabel =
    commissionBps % 100 === 0 ? `${commissionBps / 100}` : (commissionBps / 100).toFixed(1);

  if (pageLoading || !userEmail) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-100">
        <p className="text-gray-600">טוען...</p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gray-100 text-right" dir="rtl">
      {/* Mobile Tab Bar */}
      <div className="md:hidden flex overflow-x-auto bg-white px-3 py-2 gap-1 border-b" style={{ borderColor: '#E1E1E2' }}>
        {[
          { key: 'general' as const, label: 'כללי' },
          { key: 'rules' as const, label: 'כללי הקהילה' },
          { key: 'social' as const, label: 'רשתות חברתיות' },
          ...(isOwner ? [{ key: 'payments' as const, label: 'תשלומים' }] : []),
        ].map(tab => {
          // While suspended, only Payments is interactive — the other tabs
          // would 403 server-side on save, so dim them and skip the click.
          const tabDisabled = isSuspended && tab.key !== 'payments';
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { if (!tabDisabled) setActiveTab(tab.key); }}
              aria-disabled={tabDisabled}
              className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition ${
                activeTab === tab.key
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100 font-normal'
              } ${tabDisabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Layout with Sidebar */}
      <div className="flex min-h-[calc(100vh-72px)]">
        {/* Right Sidebar - Settings Tabs (hidden on mobile) */}
        <aside className="hidden md:block w-64 bg-white border-l border-gray-200 p-6 flex-shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <HiOutlineCog6Tooth className="w-5 h-5" style={{ color: '#000000' }} />
            <h2 className="font-semibold" style={{ color: '#1D1D20', fontSize: '21px' }}>הגדרות</h2>
          </div>
          
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => { if (!isSuspended) setActiveTab('general'); }}
              aria-disabled={isSuspended}
              className={`w-full text-right px-4 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'general'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${isSuspended ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-600' : ''}`}
              style={{ fontSize: '16px' }}
            >
              כללי
            </button>
            <button
              type="button"
              onClick={() => { if (!isSuspended) setActiveTab('rules'); }}
              aria-disabled={isSuspended}
              className={`w-full text-right px-4 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'rules'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${isSuspended ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-600' : ''}`}
              style={{ fontSize: '16px' }}
            >
              כללי הקהילה
            </button>
            <button
              type="button"
              onClick={() => { if (!isSuspended) setActiveTab('social'); }}
              aria-disabled={isSuspended}
              className={`w-full text-right px-4 py-2.5 rounded-lg font-medium transition ${
                activeTab === 'social'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${isSuspended ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-600' : ''}`}
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
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <form ref={formRef} onSubmit={handleUpdateCommunity} className="max-w-5xl pb-28">

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-8 space-y-8">
                {/* Community Name */}
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
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
                      maxLength={50}
                    />
                    <span className={`text-xs mt-1 block text-left ${name.length > 45 ? 'text-[#B3261E]' : 'text-gray-400'}`}>
                      {name.length}/50
                    </span>
                  </div>
                </div>

                {/* Community URL */}
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">לינק (URL)</h3>
                    <p className="text-sm text-gray-500 mt-1">הכתובת הציבורית של הקהילה (אותיות באנגלית, מספרים ומקפים בלבד)</p>
                  </div>
                  <div className="flex-1">
                    {/* Slug input */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2" dir="ltr">
                      <div className="flex items-center flex-1 border border-gray-300 rounded-lg overflow-hidden">
                        <span className="px-3 sm:px-4 py-3.5 bg-gray-50 text-gray-500 text-xs sm:text-base border-r border-gray-300 whitespace-nowrap">withly.co.il/communities/</span>
                        <input
                          type="text"
                          placeholder="הזן כתובת מותאמת אישית"
                          className="flex-1 p-3.5 text-left text-gray-900 text-base bg-white focus:outline-none min-w-0"
                          value={slug}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          maxLength={50}
                        />
                      </div>
                    </div>
                    {slugError && (
                      <p className="text-error mt-2" dir="rtl" style={{ fontSize: '14px' }}>{slugError}</p>
                    )}
                  </div>
                </div>

                {/* Logo */}
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
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
                          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#B3261E] text-error transition text-base font-normal w-44 hover:opacity-80"
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
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
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
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
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
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">תמונות הקהילה</h3>
                    <p className="text-sm text-gray-500 mt-1">תמונות שיוצגו בעמוד הקהילה</p>
                  </div>
                  <div className="flex-1">
                  {images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                      {images.map((img, index) => (
                        <div key={index} className="relative group aspect-video">
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
                          <div className="absolute inset-0 bg-black/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ borderRadius: '12px', gap: '8px' }}>
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
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
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
                          <div key={index} className="flex items-center gap-3 bg-blue-lighter rounded-lg p-3 border" style={{ borderColor: '#91DCED' }}>
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

                {/* Community Status */}
                <div className="space-y-3">
                  <div className="text-right">
                    <h3 className="font-semibold text-black" style={{ fontSize: '18px' }}>מצב הקהילה</h3>
                    <p className="mt-1" style={{ fontSize: '14px', color: '#3F3F46', fontWeight: 400 }}>קובע מי יכול לראות את הקהילה ולהצטרף אליה</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Draft — disabled when there are non-owner members
                        (would zombie them since canViewDraft excludes USER role) */}
                    {(() => {
                      // memberCount returned by the API includes the owner, so
                      // non-owner members = memberCount - 1.
                      const draftBlocked = (community?.memberCount ?? 1) > 1 && communityStatus !== 'DRAFT';
                      const draftButton = (
                        <button
                          type="button"
                          onClick={() => {
                            if (draftBlocked) return;
                            if (communityStatus !== 'DRAFT') setPendingStatus('DRAFT');
                          }}
                          aria-disabled={draftBlocked}
                          className={`group w-full flex flex-col justify-start p-4 border-2 text-right transition relative ${
                            communityStatus === 'DRAFT'
                              ? 'border-black bg-gray-50'
                              : draftBlocked
                                ? 'bg-white opacity-50 cursor-not-allowed'
                                : 'bg-white hover:border-gray-300'
                          }`}
                          style={{ borderColor: communityStatus === 'DRAFT' ? '#000000' : '#D0D0D4', borderRadius: '16px' }}
                        >
                          <div className="absolute top-4 left-4">
                            {communityStatus === 'DRAFT' ? (
                              <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                                <CheckIcon size={12} color="#FFFFFF" />
                              </div>
                            ) : (
                              <div className={`w-5 h-5 rounded-full border ${draftBlocked ? '' : 'opacity-0 group-hover:opacity-100'} transition`} style={{ borderColor: '#D0D0D4' }} />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <EditIcon size={16} color={communityStatus === 'DRAFT' ? '#000000' : '#3F3F46'} />
                            <span style={{ fontSize: '16px', fontWeight: 400, color: communityStatus === 'DRAFT' ? '#000000' : '#3F3F46' }}>טיוטה</span>
                          </div>
                          <p style={{ fontSize: '14px', fontWeight: 400, color: communityStatus === 'DRAFT' ? '#000000' : '#3F3F46' }}>רק אתם רואים את הקהילה ואף אחד אחר לא יכול להיכנס.</p>
                        </button>
                      );
                      if (draftBlocked) {
                        return (
                          <ComingSoonTooltip
                            tailDirection="up"
                            text="לא ניתן להעביר למצב טיוטה כשיש חברים בקהילה"
                            wrapperClassName="flex-1"
                          >
                            {draftButton}
                          </ComingSoonTooltip>
                        );
                      }
                      return <div className="flex-1">{draftButton}</div>;
                    })()}
                    {/* Private */}
                    <button
                      type="button"
                      onClick={() => communityStatus !== 'PRIVATE' && setPendingStatus('PRIVATE')}
                      className={`group flex-1 flex flex-col justify-start p-4 border-2 text-right transition relative ${
                        communityStatus === 'PRIVATE'
                          ? 'border-black bg-gray-50'
                          : 'bg-white hover:border-gray-300'
                      }`}
                      style={{ borderColor: communityStatus === 'PRIVATE' ? '#000000' : '#D0D0D4', borderRadius: '16px' }}
                    >
                      <div className="absolute top-4 left-4">
                        {communityStatus === 'PRIVATE' ? (
                          <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                            <CheckIcon size={12} color="#FFFFFF" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border opacity-0 group-hover:opacity-100 transition" style={{ borderColor: '#D0D0D4' }} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon size={16} color={communityStatus === 'PRIVATE' ? '#000000' : '#3F3F46'} />
                        <span style={{ fontSize: '16px', fontWeight: 400, color: communityStatus === 'PRIVATE' ? '#000000' : '#3F3F46' }}>פרטית</span>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 400, color: communityStatus === 'PRIVATE' ? '#000000' : '#3F3F46' }}>רק מי שיש לו לינק הזמנה יכול להצטרף לקהילה.</p>
                    </button>
                    {/* Public */}
                    <button
                      type="button"
                      onClick={() => communityStatus !== 'PUBLIC' && setPendingStatus('PUBLIC')}
                      className={`group flex-1 flex flex-col justify-start p-4 border-2 text-right transition relative ${
                        communityStatus === 'PUBLIC'
                          ? 'border-black bg-gray-50'
                          : 'bg-white hover:border-gray-300'
                      }`}
                      style={{ borderColor: communityStatus === 'PUBLIC' ? '#000000' : '#D0D0D4', borderRadius: '16px' }}
                    >
                      <div className="absolute top-4 left-4">
                        {communityStatus === 'PUBLIC' ? (
                          <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                            <CheckIcon size={12} color="#FFFFFF" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border opacity-0 group-hover:opacity-100 transition" style={{ borderColor: '#D0D0D4' }} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <GlobeIcon size={16} color={communityStatus === 'PUBLIC' ? '#000000' : '#3F3F46'} />
                        <span style={{ fontSize: '16px', fontWeight: 400, color: communityStatus === 'PUBLIC' ? '#000000' : '#3F3F46' }}>ציבורית</span>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 400, color: communityStatus === 'PUBLIC' ? '#000000' : '#3F3F46' }}>הקהילה מופיעה בעמוד הבית וכל אחד יכול להצטרף.</p>
                    </button>
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

              </div>
            )}

            {/* Rules Tab */}
            {activeTab === 'rules' && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
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
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="md:w-48 flex-shrink-0 text-right">
                    <h3 className="font-medium text-gray-900 text-base">רשתות חברתיות</h3>
                    <p className="text-sm text-gray-500 mt-1">קישורים לפרופילים החברתיים שלך</p>
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
              <>
                {isSuspended && (
                  <div
                    className="rounded-lg p-4 text-right mb-6"
                    style={{
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'var(--color-error)',
                      backgroundColor: '#FEE2E2',
                    }}
                  >
                    <h4 className="font-semibold text-[16px] mb-1 text-error">
                      המנוי שלך מושבת
                    </h4>
                    <p className="text-[16px] leading-relaxed text-error">
                      תקופת המנוי הסתיימה והקהילה כרגע לא זמינה לחברים. לחידוש המנוי, יש לעדכן כרטיס אשראי תקין.
                    </p>
                  </div>
                )}

                {/* Card 1 — community pricing (what the owner charges members) */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div>
                      <h3 className="font-medium text-gray-900 text-base">מחיר חודשי</h3>
                      <p className="text-sm text-gray-500 mt-1">כאן קובעים אם ההצטרפות לקהילה כרוכה בתשלום.</p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="inline-flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsPaidCommunity(false);
                            setPrice(0);
                          }}
                          disabled={!!pendingPriceEffectiveAt}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-base font-normal border transition disabled:cursor-not-allowed ${
                            !isPaidCommunity
                              ? 'border-black bg-white text-gray-600'
                              : `border-gray-300 bg-white text-gray-600 ${pendingPriceEffectiveAt ? 'opacity-50' : 'hover:border-gray-400'}`
                          }`}
                        >
                          <NoFeeIcon className="w-4.5 h-4.5 text-gray-600" />
                          <span>חינם להצטרפות</span>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${
                            !isPaidCommunity ? 'border-black' : 'border-gray-300'
                          }`}>
                            {!isPaidCommunity && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#A7EA7B' }} />}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPaidCommunity(true);
                            if (price < 10) setPrice(10);
                          }}
                          disabled={!!pendingPriceEffectiveAt}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-base font-normal border transition disabled:cursor-not-allowed ${
                            isPaidCommunity
                              ? 'border-black bg-white text-gray-600'
                              : `border-gray-300 bg-white text-gray-600 ${pendingPriceEffectiveAt ? 'opacity-50' : 'hover:border-gray-400'}`
                          }`}
                        >
                          <DollarIcon className="w-4.5 h-4.5 text-gray-600" />
                          <span>מנוי בתשלום</span>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${
                            isPaidCommunity ? 'border-black' : 'border-gray-300'
                          }`}>
                            {isPaidCommunity && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#91DCED' }} />}
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-6 border-t border-gray-200">
                    <div className={`flex-shrink-0 ${!isPaidCommunity ? 'opacity-50' : ''}`}>
                      <h3 className="font-medium text-gray-900 text-base">עלות מנוי חודשי</h3>
                      <p className="text-sm text-gray-500 mt-1">סכום החיוב החודשי בשקלים לכל חבר קהילה</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden w-full">
                        <span className={`px-5 py-3.5 bg-gray-50 text-lg font-medium border-l border-gray-300 ${
                          isPaidCommunity && !pendingPriceEffectiveAt ? 'text-gray-600' : 'text-gray-300'
                        }`}>₪</span>
                        <input
                          type="number"
                          step="1"
                          placeholder=""
                          className={`flex-1 p-3.5 text-right text-lg focus:outline-none ${
                            isPaidCommunity && !pendingPriceEffectiveAt
                              ? 'bg-white'
                              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          }`}
                          value={isPaidCommunity ? (price === 0 ? '' : price) : ''}
                          onKeyDown={(e) => {
                            // Block characters <input type=number> accepts but we don't want.
                            if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setPrice(0);
                              return;
                            }
                            // Strip any non-digit/minus chars that slipped through
                            // (paste, IME, etc.).
                            const intRaw = raw.replace(/[^\d-]/g, '');
                            if (intRaw === '' || intRaw === '-') {
                              setPrice(0);
                              return;
                            }
                            const v = parseInt(intRaw, 10);
                            if (Number.isFinite(v)) {
                              setPrice(v);
                            }
                          }}
                          disabled={!isPaidCommunity || !!pendingPriceEffectiveAt}
                        />
                      </div>
                      {pendingPriceEffectiveAt && pendingPrice !== null && (
                        <p className="text-sm mt-2" style={{ color: 'var(--color-gray-7)' }}>
                          {`שינוי המחיר ל-₪${pendingPrice} ייכנס לתוקף בתאריך ${formatHebrewDate(pendingPriceEffectiveAt)}.`}
                        </p>
                      )}
                    </div>
                    {(() => {
                      const init = initialFormRef.current;
                      const changed =
                        !!init &&
                        (isPaidCommunity !== init.isPaidCommunity ||
                          (isPaidCommunity && price !== init.price));
                      // Always rendered — active only when there's an actual
                      // pricing change to confirm and nothing's pending/in-flight.
                      const disabled =
                        !changed ||
                        !!pendingPriceEffectiveAt ||
                        loading ||
                        announcingPrice;
                      return (
                        <button
                          type="button"
                          onClick={() => openPriceChangeIfChanged(isPaidCommunity, price)}
                          disabled={disabled}
                          className="text-[16px] font-normal bg-white text-black hover:bg-gray-50 transition flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            border: '1px solid var(--color-gray-4)',
                            borderRadius: '12px',
                            padding: '0.5rem 1.25rem',
                          }}
                        >
                          עדכן מחיר
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Card 3 — community revenue. Visible whenever the community
                    is earning OR will earn (covers price-change grace periods,
                    including free↔paid transitions). Gated on the saved price
                    reality, not the form's paid/free radio. */}
                {(currentCommunityPrice > 0 || (pendingPrice ?? 0) > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-6">
                    <h3 className="text-[18px] font-semibold text-black">הכנסות הקהילה</h3>

                    <div className="flex flex-wrap gap-4 mt-4">
                      <div
                        className="rounded-md px-5 py-3 flex flex-col gap-1"
                        style={{ backgroundColor: 'var(--color-green-lighter)', width: 'fit-content', minWidth: '160px' }}
                      >
                        <span className="text-[16px] font-normal text-black">הכנסה חודשית</span>
                        <span className="text-[28px] font-semibold text-black leading-none">
                          ₪{grossMonthly}
                        </span>
                      </div>
                      <div
                        className="rounded-md px-5 py-3 flex flex-col gap-1"
                        style={{ backgroundColor: 'var(--color-green-lighter)', width: 'fit-content', minWidth: '160px' }}
                      >
                        <span className="text-[16px] font-normal text-black">
                          חברים משלמים
                          <span className="text-[13px] font-normal text-black"> (פעילים כרגע)</span>
                        </span>
                        <span className="text-[28px] font-semibold text-black leading-none">
                          {totalPayingMembers}
                        </span>
                      </div>
                    </div>

                    {/* Ledger-derived lifetime figures. Rendered once the
                        earnings fetch resolves. */}
                    {earnings && (
                      <div className="flex flex-wrap gap-4 mt-4">
                        <div
                          className="rounded-md px-5 py-3 flex flex-col gap-1 bg-gray-50"
                          style={{ width: 'fit-content', minWidth: '160px' }}
                        >
                          <span className="text-[16px] font-normal text-black">הכנסה מצטברת</span>
                          <span className="text-[28px] font-semibold text-black leading-none">
                            ₪{earnings.earnedToDateNet}
                          </span>
                        </div>
                        {earnings.totalRefunds > 0 && (
                          <div
                            className="rounded-md px-5 py-3 flex flex-col gap-1 bg-gray-50"
                            style={{ width: 'fit-content', minWidth: '160px' }}
                          >
                            <span className="text-[16px] font-normal text-black">סך ההחזרים</span>
                            <span className="text-[28px] font-semibold text-black leading-none">
                              ₪{earnings.totalRefunds}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="my-6" style={{ borderTop: '1px solid var(--color-gray-4)' }} />

                    <h4 className="text-[18px] font-semibold text-black mb-6">חברים אחרונים ששילמו</h4>

                    {recentMembers.length === 0 ? (
                      <p
                        className="text-[16px] font-normal"
                        style={{ color: 'var(--color-gray-10)' }}
                      >
                        עדיין אין חברים משלמים.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {recentMembers.map(m => {
                          // After an announcement, members joined on/after
                          // priceChangeAnnouncedAt pay the new price; older
                          // members are grandfathered at currentCommunityPrice.
                          const joinedAt = new Date(m.joinedAt);
                          const onNewPrice =
                            !!priceChangeAnnouncedAt && joinedAt >= priceChangeAnnouncedAt;
                          const memberPrice = onNewPrice
                            ? (pendingPrice ?? currentCommunityPrice)
                            : currentCommunityPrice;
                          return (
                            <li
                              key={m.id}
                              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                            >
                              <span className="text-[16px] font-normal text-black">{m.name}</span>
                              <span
                                className="text-[16px] font-normal"
                                style={{ color: 'var(--color-gray-10)' }}
                              >
                                {`${formatSlashDate(joinedAt)} · ₪${memberPrice}`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {/* Card 2 — owner's Withly subscription */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-6">
                  <div className="mb-6">
                    <h3 className="text-[18px] font-semibold text-black">המנוי שלך ב-Withly</h3>
                    <p
                      className="text-[16px] font-normal mt-1"
                      style={{ color: 'var(--color-gray-7)' }}
                    >
                      החבילה שלך לניהול הקהילה
                    </p>
                  </div>

                  {/* Gray summary panel — price, next billing date, optional trial copy */}
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: 'var(--color-gray-2)' }}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[18px] font-semibold text-black">
                        ₪{planMonthlyPrice} / חודש
                      </span>
                      <span className="text-[16px] font-normal text-black">
                        החיוב הבא: {formatHebrewDate(nextBillingDate ?? new Date())}
                      </span>
                      <span className="text-[16px] font-normal text-black">
                        עמלת עסקאות: {commissionRateLabel}%
                      </span>
                    </div>
                    {isInTrial(trialStartDate, planTrialLength) && (
                      <p className="text-[16px] font-normal text-black mt-3 leading-relaxed">
                        {`תקופת הניסיון שלך (חודש) מסתיימת ב-${formatHebrewDate(getTrialEnd(trialStartDate, planTrialLength)!)}. החל מאותו תאריך יחויב אמצעי התשלום שלך ב-₪${planMonthlyPrice} לחודש.`}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="my-6" style={{ borderTop: '1px solid var(--color-gray-4)' }} />

                  {/* Payment method row — hidden when suspended; the single
                      suspended row below carries the renew CTA instead. */}
                  {!isSuspended && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <CreditCardIcon className="w-6 h-6 text-black flex-shrink-0" />
                          <span className="text-[16px] font-normal text-black truncate">
                            {cardLastFour
                              ? `כרטיס נוכחי: ${cardBrand || 'Visa'} ···· ${cardLastFour}`
                              : 'אין כרטיס בתוקף'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCardModal(true)}
                          className="text-[16px] font-normal bg-white text-black hover:bg-gray-50 transition flex-shrink-0"
                          style={{
                            border: '1px solid var(--color-gray-4)',
                            borderRadius: '12px',
                            padding: '0.5rem 1.25rem',
                          }}
                        >
                          עדכן אמצעי תשלום
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="my-6" style={{ borderTop: '1px solid var(--color-gray-4)' }} />
                    </>
                  )}

                  {/* Cancel subscription / suspended state */}
                  {isSuspended ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <p className="text-[16px] font-normal text-error flex-1">
                        הקהילה מושבתת
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCardModal(true)}
                        className="text-[16px] font-normal bg-white text-black hover:bg-gray-50 transition flex-shrink-0"
                        style={{
                          border: '1px solid var(--color-gray-4)',
                          borderRadius: '12px',
                          padding: '0.5rem 1.25rem',
                        }}
                      >
                        חדש מנוי
                      </button>
                    </div>
                  ) : subscriptionCancelledAt ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <p className="text-[16px] font-normal text-error flex-1">
                        {`המנוי יבוטל בתאריך ${formatHebrewDate(subscriptionCancelledAt)} והקהילה תושבת.`}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          setUndoingCancellation(true);
                          try {
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/payment`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ subscriptionCancelledAt: null }),
                            });
                            if (res.ok) {
                              setSubscriptionCancelledAt(null);
                              setMessage('השבתת המנוי בוטלה.');
                              setMessageType('success');
                              // Refresh context so the red feed banner clears
                              // immediately on the next navigation.
                              refreshCommunity().catch(() => {});
                            } else {
                              setMessage('שגיאה בביטול ההשבתה');
                              setMessageType('error');
                            }
                          } catch {
                            setMessage('שגיאה בביטול ההשבתה');
                            setMessageType('error');
                          } finally {
                            setUndoingCancellation(false);
                          }
                        }}
                        disabled={undoingCancellation}
                        className="text-[16px] font-normal bg-white text-black hover:bg-gray-50 transition disabled:opacity-50 flex-shrink-0"
                        style={{
                          border: '1px solid var(--color-gray-4)',
                          borderRadius: '12px',
                          padding: '0.5rem 1.25rem',
                        }}
                      >
                        {undoingCancellation ? 'מבטל...' : 'ביטול השבתה'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCancelSubscriptionModal(true)}
                      className="text-[16px] font-normal bg-white text-error hover:bg-red-50 transition"
                      style={{
                        border: '1px solid var(--color-error)',
                        borderRadius: '12px',
                        padding: '0.5rem 1.25rem',
                      }}
                    >
                      בטל מנוי
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Inline Message Banner */}
            {message && (
              <div
                ref={messageRef}
                className="mt-4 px-6 py-3 rounded-lg"
                style={messageType === 'error'
                  ? { backgroundColor: '#FEE2E2', color: 'var(--color-error)' }
                  : { backgroundColor: 'var(--color-green-light)', color: 'black', fontSize: '16px', fontWeight: 400 }
                }
              >
                <span>{message}</span>
              </div>
            )}

          </form>

          {/* Floating Save/Cancel on the form-like tabs only. Payments is a
              set of discrete, confirmation-gated actions — pricing commits
              through the price-change announcement popup, card/cancel-sub
              through their own modals — so no save bar there. */}
          <StickySaveBar
            visible={activeTab !== 'payments' && hasUnsavedChanges(false)}
            saving={loading}
            onSave={() => handleUpdateCommunity()}
            onCancel={handleResetCommunity}
          />

          {/* Credit Card Modal — iframe-based (Phase 3.2). After payment
              completes, HYP redirects the parent window to ?card=updated;
              the URL-param handler below picks it up. */}
          <UpdateCardModal
            isOpen={showCardModal}
            onClose={() => setShowCardModal(false)}
            communityId={communityId}
            wasSuspended={isSuspended}
            amount={planMonthlyPrice}
          />


          {/* Price Change Confirmation Modal - Outside form */}
          {showPriceChangeConfirmModal && (() => {
            const effectiveDate = addMonths(new Date(), 1);
            const newPriceVal = isPaidCommunity ? price : 0;
            const oldPriceVal = initialFormRef.current?.price ?? 0;
            return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div
                  className="bg-white p-6 text-center"
                  dir="rtl"
                  style={{
                    borderRadius: '16px',
                    width: 'fit-content',
                    maxWidth: 'min(90vw, 640px)',
                  }}
                >
                  <h2
                    className="font-semibold text-black"
                    style={{ fontSize: '21px', marginBottom: '12px' }}
                  >
                    שינוי מחיר הקהילה
                  </h2>
                  <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)', marginBottom: '4px' }}>
                    {`המחיר החדש (₪${newPriceVal}) ייכנס לתוקף עבור חברים חדשים מיד.`}
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)', marginBottom: '4px' }}>
                    {`חברים קיימים ימשיכו לשלם ₪${oldPriceVal} עד ה-${formatHebrewDate(effectiveDate)} ואז יעברו אוטומטית למחיר החדש.`}
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--color-gray-10)' }}>
                    שינוי זה ניתן לעשות רק פעם אחת בחודש.
                  </p>
                  <div className="flex gap-3 justify-center" style={{ marginTop: '24px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        // Cancel = abandon the price change: revert just the
                        // pricing fields to the saved snapshot (not the whole
                        // form, so edits on other tabs survive), then close.
                        // Restoring from the snapshot is the correct revert —
                        // the old radio-flip bug came from mutating state
                        // rather than restoring the saved values.
                        const init = initialFormRef.current;
                        if (init) {
                          setPrice(init.price);
                          setIsPaidCommunity(init.isPaidCommunity);
                        }
                        setShowPriceChangeConfirmModal(false);
                      }}
                      disabled={announcingPrice}
                      style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
                      className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setAnnouncingPrice(true);
                        try {
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/${communityId}/payment/announce-price`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newPrice: newPriceVal }),
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            const msg = err?.message === 'PRICE_CHANGE_RATE_LIMIT'
                              ? 'ניתן לשנות את המחיר פעם בחודש בלבד'
                              : 'שגיאה בעדכון המחיר';
                            setMessage(msg);
                            setMessageType('error');
                            setShowPriceChangeConfirmModal(false);
                            return;
                          }
                          const updated = await res.json();
                          setPendingPrice(typeof updated.pendingPrice === 'number' ? updated.pendingPrice : newPriceVal);
                          setPendingPriceEffectiveAt(updated.pendingPriceEffectiveAt ? new Date(updated.pendingPriceEffectiveAt) : effectiveDate);
                          setPriceChangeAnnouncedAt(updated.priceChangeAnnouncedAt ? new Date(updated.priceChangeAnnouncedAt) : new Date());
                          setShowPriceChangeConfirmModal(false);
                          // Re-fire the save so the rest of the form's edits
                          // also persist; skipPriceRef tells the handler not
                          // to re-trip the intercept and to skip price field.
                          skipPriceRef.current = true;
                          formRef.current?.requestSubmit();
                        } catch {
                          setMessage('שגיאה בעדכון המחיר');
                          setMessageType('error');
                          setShowPriceChangeConfirmModal(false);
                        } finally {
                          setAnnouncingPrice(false);
                        }
                      }}
                      disabled={announcingPrice}
                      style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
                      className="bg-black text-white hover:opacity-90 transition disabled:opacity-50"
                    >
                      {announcingPrice ? 'מעדכן...' : 'עדכון המחיר'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Cancel Subscription Confirmation Modal - Outside form */}
          <CancelSubscriptionModal
            isOpen={showCancelSubscriptionModal}
            onClose={() => setShowCancelSubscriptionModal(false)}
            communityId={communityId}
            effectiveDate={nextBillingDate ?? new Date()}
            isPaidCommunity={isPaidCommunity}
            paidMembersCount={isPaidCommunity ? Math.max(0, (community?.memberCount ?? 1) - 1) : 0}
            onSuccess={(eff) => {
              setSubscriptionCancelledAt(eff);
              setShowCancelSubscriptionModal(false);
              setMessage('המנוי בוטל בהצלחה');
              setMessageType('success');
              refreshCommunity().catch(() => {});
            }}
            onError={() => {
              setMessage('שגיאה בביטול המנוי');
              setMessageType('error');
              setShowCancelSubscriptionModal(false);
            }}
          />
        </main>
      </div>

      {/* Status Change Confirmation Modal */}
      {pendingStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white p-6 text-center"
            dir="rtl"
            style={{ borderRadius: '16px', width: 'fit-content', maxWidth: 'min(90vw, 640px)' }}
          >
            <h2 className="font-semibold text-black" style={{ fontSize: '21px', marginBottom: '12px' }}>
              {pendingStatus === 'DRAFT' && 'להעביר את הקהילה למצב טיוטה?'}
              {pendingStatus === 'PRIVATE' && 'להעביר את הקהילה למצב פרטי?'}
              {pendingStatus === 'PUBLIC' && 'להפעיל את הקהילה?'}
            </h2>
            <p style={{ fontSize: '18px', fontWeight: 400, color: '#1D1D20', marginBottom: '24px' }}>
              {pendingStatus === 'DRAFT' && 'חברים קיימים יישארו בקהילה כרגיל, אבל אנשים חדשים לא יוכלו להצטרף.'}
              {pendingStatus === 'PRIVATE' && 'הקהילה לא תופיע בעמוד הבית. אנשים חדשים יוכלו להצטרף רק דרך לינק הזמנה.'}
              {pendingStatus === 'PUBLIC' && 'הקהילה תופיע בעמוד הבית וכל אחד יוכל להצטרף אליה.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem', borderColor: 'var(--color-black)' }}
                className="bg-white text-black border hover:bg-gray-50 transition"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommunityStatus(pendingStatus);
                  setPendingStatus(null);
                }}
                style={{ fontSize: '16px', fontWeight: 400, borderRadius: '12px', padding: '0.375rem 1.25rem' }}
                className="bg-black text-white hover:opacity-90 transition"
              >
                {pendingStatus === 'DRAFT' && 'העברה לטיוטה'}
                {pendingStatus === 'PRIVATE' && 'הפיכה לפרטית'}
                {pendingStatus === 'PUBLIC' && 'הפעלת הקהילה'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
