'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { getImageUrl } from '@/app/lib/imageUrl';
import { useUser } from '../lib/UserContext';
import { useSocketContext } from '../lib/SocketContext';
import CloseIcon from './icons/CloseIcon';
import TrashIcon from './icons/TrashIcon';

interface Notification {
  id: string;
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'NEW_POST' | 'MENTION' | 'COMMUNITY_JOIN' | 'COMMUNITY_BAN' | 'COMMUNITY_BAN_LIFTED' | 'COMMUNITY_SCHEDULED_FOR_SUSPENSION' | 'COMMUNITY_SUSPENDED' | 'COMMUNITY_REACTIVATED' | 'PAYMENT_FAILED' | 'PRICE_CHANGE_ANNOUNCED' | 'EVENT_REMINDER';
  message?: string;
  isRead: boolean;
  createdAt: string;
  postId?: string;
  communityId?: string;
  actor?: {
    id: string;
    name: string;
    profileImage?: string;
  };
  post?: {
    id: string;
    title?: string;
    community?: {
      id: string;
      name: string;
    };
  };
  community?: {
    id: string;
    name: string;
    slug?: string | null;
    ownerId?: string;
    logo?: string | null;
  };
}

interface GroupedNotification {
  key: string;
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'NEW_POST' | 'MENTION' | 'COMMUNITY_JOIN' | 'COMMUNITY_BAN' | 'COMMUNITY_BAN_LIFTED' | 'COMMUNITY_SCHEDULED_FOR_SUSPENSION' | 'COMMUNITY_SUSPENDED' | 'COMMUNITY_REACTIVATED' | 'PAYMENT_FAILED' | 'PRICE_CHANGE_ANNOUNCED' | 'EVENT_REMINDER';
  notifications: Notification[];
  latestAt: string;
  isRead: boolean;
  postId?: string;
  communityId?: string;
  post?: Notification['post'];
  community?: Notification['community'];
}

// Group notifications by type and target
const groupNotifications = (notifications: Notification[]): GroupedNotification[] => {
  const groups: Record<string, GroupedNotification> = {};

  notifications.forEach((n) => {
    let key: string;
    
    // Group by type + target
    if (n.type === 'LIKE' && n.postId) {
      key = `like-${n.postId}`;
    } else if (n.type === 'COMMENT' && n.postId) {
      key = `comment-${n.postId}`;
    } else if (n.type === 'FOLLOW') {
      key = 'follows';
    } else {
      // Don't group other types
      key = n.id;
    }

    if (!groups[key]) {
      groups[key] = {
        key,
        type: n.type,
        notifications: [],
        latestAt: n.createdAt,
        isRead: true,
        postId: n.postId,
        communityId: n.communityId,
        post: n.post,
        community: n.community,
      };
    }

    groups[key].notifications.push(n);
    if (!n.isRead) groups[key].isRead = false;
    if (new Date(n.createdAt) > new Date(groups[key].latestAt)) {
      groups[key].latestAt = n.createdAt;
    }
  });

  // Sort by latest notification time
  return Object.values(groups).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
};

// Types where the notification is about the community itself, not a person —
// so the avatar should be the community logo (→ initial fallback), even when
// an actor (owner/creator) is attached. Person-driven and "X did something to
// you" types (LIKE, BAN, REACTIVATED, …) keep the actor's face.
const COMMUNITY_AVATAR_TYPES = new Set<GroupedNotification['type']>([
  'COMMUNITY_SUSPENDED',
  'COMMUNITY_SCHEDULED_FOR_SUSPENSION',
  'PRICE_CHANGE_ANNOUNCED',
  'EVENT_REMINDER',
  'PAYMENT_FAILED',
]);

const getGroupedNotificationText = (group: GroupedNotification) => {
  const count = group.notifications.length;
  const firstActor = group.notifications[0]?.actor?.name || 'משתמש שנמחק';

  switch (group.type) {
    case 'LIKE':
      if (count === 1) return `${firstActor} אהב/ה את הפוסט שלך`;
      return `${firstActor} ו-${count - 1} אחרים אהבו את הפוסט שלך`;
    case 'COMMENT':
      if (count === 1) return `${firstActor} הגיב/ה על הפוסט שלך`;
      return `${firstActor} ו-${count - 1} אחרים הגיבו על הפוסט שלך`;
    case 'FOLLOW':
      if (count === 1) return `${firstActor} התחיל/ה לעקוב אחריך`;
      return `${firstActor} ו-${count - 1} אחרים התחילו לעקוב אחריך`;
    case 'NEW_POST':
      return `${firstActor} פרסם/ה פוסט חדש ב${group.community?.name || 'קהילה'}`;
    case 'MENTION':
      return `${firstActor} הזכיר/ה אותך בתגובה`;
    case 'COMMUNITY_JOIN':
      return `${firstActor} הצטרף/ה לקהילה ${group.community?.name || ''}`;
    case 'COMMUNITY_BAN':
      return `${firstActor} השעה אותך מ${group.community?.name || 'הקהילה'}`;
    case 'COMMUNITY_BAN_LIFTED':
      return `${firstActor} ביטל את ההשעיה שלך מ${group.community?.name || 'הקהילה'}`;
    case 'COMMUNITY_SCHEDULED_FOR_SUSPENSION':
      return group.community?.name
        ? `${firstActor} החל/ה תהליך השבתה של קהילת ${group.community.name}`
        : `${firstActor} החל/ה תהליך השבתה של הקהילה`;
    case 'COMMUNITY_SUSPENDED':
      return `הקהילה ${group.community?.name || ''} הושבתה`;
    case 'COMMUNITY_REACTIVATED':
      return `${firstActor} הפעיל/ה מחדש את הקהילה ${group.community?.name || ''}`;
    case 'PAYMENT_FAILED':
      return group.community?.name
        ? `החיוב לקהילה "${group.community.name}" לא עבר`
        : 'החיוב לקהילה לא עבר';
    case 'PRICE_CHANGE_ANNOUNCED':
      return group.community?.name
        ? `מחיר הקהילה "${group.community.name}" עומד להתעדכן`
        : 'מחיר הקהילה עומד להתעדכן';
    case 'EVENT_REMINDER':
      // The Notification row carries no eventId/name (only communityId), so
      // the title references the community, not the specific event.
      return group.community?.name
        ? `תזכורת לאירוע בקהילה "${group.community.name}"`
        : 'תזכורת לאירוע קרוב';
    default:
      return 'התראה חדשה';
  }
};

const getGroupedNotificationLink = (group: GroupedNotification, currentUserId?: string): string | null => {
  switch (group.type) {
    case 'LIKE':
    case 'COMMENT':
    case 'MENTION': {
      // Prefer slug — landing on the canonical URL avoids the feed page's
      // slug-redirect that would otherwise refetch the page once the
      // community payload arrives.
      const communityIdOrSlug = group.community?.slug || group.communityId || group.post?.community?.id;
      if (communityIdOrSlug) {
        return `/communities/${communityIdOrSlug}/feed`;
      }
      return null;
    }
    case 'FOLLOW': {
      // Link to first follower's profile
      const actorId = group.notifications[0]?.actor?.id;
      if (actorId) {
        return `/profile/${actorId}`;
      }
      return null;
    }
    case 'NEW_POST':
    case 'COMMUNITY_JOIN': {
      const idOrSlug = group.community?.slug || group.communityId || group.community?.id;
      if (idOrSlug) {
        return `/communities/${idOrSlug}/feed`;
      }
      return null;
    }
    case 'COMMUNITY_BAN':
    case 'COMMUNITY_BAN_LIFTED': {
      // Both go to /preview: banned users see the banner, lifted users
      // are no longer members and need to rejoin from there.
      const idOrSlug = group.community?.slug || group.communityId || group.community?.id;
      if (idOrSlug) {
        return `/communities/${idOrSlug}/preview`;
      }
      return null;
    }
    case 'COMMUNITY_SCHEDULED_FOR_SUSPENSION':
    case 'COMMUNITY_SUSPENDED':
    case 'COMMUNITY_REACTIVATED': {
      const idOrSlug = group.community?.slug || group.communityId || group.community?.id;
      if (idOrSlug) {
        return `/communities/${idOrSlug}/feed`;
      }
      return null;
    }
    case 'PAYMENT_FAILED': {
      // Owner → community billing (manage uses the real id, not slug);
      // member → their own wallet to fix the card on file.
      const isOwner = !!currentUserId && group.community?.ownerId === currentUserId;
      if (isOwner) {
        const id = group.communityId || group.community?.id;
        return id ? `/communities/${id}/manage` : '/settings#payment';
      }
      return '/settings#payment';
    }
    case 'PRICE_CHANGE_ANNOUNCED': {
      // Preview shows the price + the announcement banner.
      const idOrSlug = group.community?.slug || group.communityId || group.community?.id;
      if (idOrSlug) {
        return `/communities/${idOrSlug}/preview`;
      }
      return null;
    }
    case 'EVENT_REMINDER': {
      // No eventId on the row → land on the community events list.
      const idOrSlug = group.community?.slug || group.communityId || group.community?.id;
      if (idOrSlug) {
        return `/communities/${idOrSlug}/events`;
      }
      return null;
    }
    default:
      return null;
  }
};

export default function NotificationBell() {
  const { user } = useUser();
  const { socket } = useSocketContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const justMarkedReadRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Subscribe to socket-pushed notifications so the bell badge updates in
  // real time. We refetch the authoritative unread count from the server
  // rather than `prev + 1` — the JS counter drifts (e.g. when an action on
  // another tab marks notifications as read). Refetching keeps the bell in
  // sync with what the dropdown rows actually show.
  useEffect(() => {
    if (!socket || !user) return;
    const handler = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/unread-count`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? data.count ?? 0);
        }
      } catch {
        // Best-effort — the 30s poll will catch up.
      }
      // If the dropdown is open, also refresh the list so the new row appears.
      if (isOpenRef.current) {
        fetchNotifications();
      }
    };
    socket.on('newNotification', handler);
    return () => { socket.off('newNotification', handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user]);

  // Fetch unread count on mount
  useEffect(() => {
    const fetchUnreadCount = async () => {
      // Skip fetch if we just marked all as read (give server time to process)
      if (justMarkedReadRef.current) return;

      if (!user) return;

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/unread-count`);
        if (res.ok) {
          const data = await res.json();
          // Handle both count and unreadCount response format
          setUnreadCount(data.unreadCount ?? data.count ?? 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };

    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markGroupAsRead = async (group: GroupedNotification, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!user) return;

    const unreadNotifications = group.notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    try {
      // Mark all notifications in the group as read
      await Promise.all(
        unreadNotifications.map(n =>
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${n.id}/read`, {
            method: 'POST',
          })
        )
      );
      
      const readIds = unreadNotifications.map(n => n.id);
      setNotifications(prev =>
        prev.map(n => readIds.includes(n.id) ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - unreadNotifications.length));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      // 1. Call API to update database
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read-all`, {
        method: 'POST',
      });

      if (res.ok) {
        // 2. Update local state
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);

        // 3. Set flag to prevent fetches from overriding our local state
        justMarkedReadRef.current = true;
        setTimeout(() => {
          justMarkedReadRef.current = false;
        }, 10000);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteGroup = async (group: GroupedNotification, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) return;
    const ids = group.notifications.map(n => n.id);
    const wasUnread = group.notifications.filter(n => !n.isRead).length;
    // Optimistic remove — keeps the bell snappy.
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    if (wasUnread > 0) setUnreadCount(prev => Math.max(0, prev - wasUnread));
    try {
      await Promise.all(
        ids.map(id =>
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`, {
            method: 'DELETE',
          }),
        ),
      );
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const deleteAllNotifications = async () => {
    if (!user) return;
    setNotifications([]);
    setUnreadCount(0);
    justMarkedReadRef.current = true;
    setTimeout(() => { justMarkedReadRef.current = false; }, 10000);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/all`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete all notifications:', err);
    }
  };

  const handleGroupClick = (group: GroupedNotification) => {
    if (!group.isRead) {
      markGroupAsRead(group);
    }
    setIsOpen(false);
  };

  const groupedNotifications = groupNotifications(notifications);

  // Get avatars for display (up to 3)
  const getGroupAvatars = (group: GroupedNotification) => {
    const actors = group.notifications
      .map(n => n.actor)
      .filter((actor, index, self) => 
        actor && self.findIndex(a => a?.id === actor.id) === index
      )
      .slice(0, 3);
    return actors;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 transition flex items-center justify-center"
        aria-label="התראות"
      >
        {/* Outline Bell Icon */}
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M10.2688 21C10.4443 21.304 10.6968 21.5565 11.0008 21.732C11.3049 21.9075 11.6497 21.9999 12.0008 21.9999C12.3519 21.9999 12.6967 21.9075 13.0008 21.732C13.3048 21.5565 13.5573 21.304 13.7328 21" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M3.26127 15.326C3.13063 15.4692 3.04442 15.6472 3.01312 15.8385C2.98183 16.0298 3.00679 16.226 3.08498 16.4034C3.16316 16.5807 3.2912 16.7316 3.45352 16.8375C3.61585 16.9434 3.80545 16.9999 3.99927 17H19.9993C20.1931 17.0001 20.3827 16.9438 20.5451 16.8381C20.7076 16.7324 20.8358 16.5817 20.9142 16.4045C20.9926 16.2273 21.0178 16.0311 20.9867 15.8398C20.9557 15.6485 20.8697 15.4703 20.7393 15.327C19.4093 13.956 17.9993 12.499 17.9993 8C17.9993 6.4087 17.3671 4.88258 16.2419 3.75736C15.1167 2.63214 13.5906 2 11.9993 2C10.408 2 8.88185 2.63214 7.75663 3.75736C6.63141 4.88258 5.99927 6.4087 5.99927 8C5.99927 12.499 4.58827 13.956 3.26127 15.326Z" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[#A7EA7B] text-black text-[11px] font-semibold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 sm:left-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[384px] bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden -translate-x-4 sm:translate-x-0" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">התראות</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                  title="סמן הכל כנקרא"
                >
                  {/* Double checkmark icon */}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={deleteAllNotifications}
                  className="p-1.5 text-gray-400 hover:bg-red-50 rounded-full transition"
                  style={{ color: undefined }}
                  title="מחק את כל ההתראות"
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
                >
                  <TrashIcon size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            <div dir="rtl">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              </div>
            ) : groupedNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="M10.2688 21C10.4443 21.304 10.6968 21.5565 11.0008 21.732C11.3049 21.9075 11.6497 21.9999 12.0008 21.9999C12.3519 21.9999 12.6967 21.9075 13.0008 21.732C13.3048 21.5565 13.5573 21.304 13.7328 21" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M3.26127 15.326C3.13063 15.4692 3.04442 15.6472 3.01312 15.8385C2.98183 16.0298 3.00679 16.226 3.08498 16.4034C3.16316 16.5807 3.2912 16.7316 3.45352 16.8375C3.61585 16.9434 3.80545 16.9999 3.99927 17H19.9993C20.1931 17.0001 20.3827 16.9438 20.5451 16.8381C20.7076 16.7324 20.8358 16.5817 20.9142 16.4045C20.9926 16.2273 21.0178 16.0311 20.9867 15.8398C20.9557 15.6485 20.8697 15.4703 20.7393 15.327C19.4093 13.956 17.9993 12.499 17.9993 8C17.9993 6.4087 17.3671 4.88258 16.2419 3.75736C15.1167 2.63214 13.5906 2 11.9993 2C10.408 2 8.88185 2.63214 7.75663 3.75736C6.63141 4.88258 5.99927 6.4087 5.99927 8C5.99927 12.499 4.58827 13.956 3.26127 15.326Z" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm">אין התראות חדשות</p>
              </div>
            ) : (
              groupedNotifications.map((group) => {
                const link = getGroupedNotificationLink(group, user?.userId);
                const avatars = getGroupAvatars(group);
                // Show the community logo for community-scoped events, and as a
                // fallback for any actor-less row (e.g. PAYMENT_FAILED has no actor).
                const useCommunityAvatar =
                  !!group.community &&
                  (COMMUNITY_AVATAR_TYPES.has(group.type) || avatars.length === 0);
                
                const innerContent = (
                  <>
                    {/* Stacked Avatars — fixed width regardless of count so
                        every row's text starts at the same horizontal position. */}
                    <div className="flex-shrink-0 relative" style={{ width: 44, height: 40 }}>
                      {useCommunityAvatar && group.community ? (
                        // Community-scoped rows (suspension, price change, event
                        // reminder, payment failed): the event is about the
                        // community, so show its logo → initial, not a member's face.
                        <div className="absolute rounded-full border-2 border-white" style={{ right: 0 }}>
                          {group.community.logo ? (
                            <img
                              src={getImageUrl(group.community.logo)}
                              alt={group.community.name}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                              {group.community.name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                      ) : (
                        avatars.map((actor, i) => (
                          <div
                            key={actor?.id || i}
                            className="absolute rounded-full border-2 border-white"
                            style={{
                              right: i * 12,
                              zIndex: avatars.length - i,
                            }}
                          >
                            {actor?.profileImage ? (
                              <img
                                src={getImageUrl(actor.profileImage)}
                                alt={actor.name}
                                className="w-9 h-9 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                                {actor?.name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 mr-2">
                      <p className={`text-sm leading-relaxed ${!group.isRead ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {getGroupedNotificationText(group)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(group.latestAt), { addSuffix: true, locale: he })}
                      </p>
                    </div>
                  </>
                );

                return (
                  <div
                    key={group.key}
                    className={`group flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition ${
                      !group.isRead ? 'bg-[#FCFCFC]' : ''
                    }`}
                  >
                    {link ? (
                      <Link
                        href={link}
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleGroupClick(group)}
                      >
                        {innerContent}
                      </Link>
                    ) : (
                      <div
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleGroupClick(group)}
                      >
                        {innerContent}
                      </div>
                    )}

                    {/* Action buttons — OUTSIDE the Link so clicking them
                        doesn't navigate. Hidden by default; revealed when the
                        row is hovered (or focused for keyboard users). */}
                    <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      {!group.isRead && (
                        <button
                          onClick={(e) => markGroupAsRead(group, e)}
                          className="p-1.5 text-gray-400 hover:text-[#65A30D] hover:bg-[#A7EA7B]/20 rounded-full transition"
                          title="סמן כנקרא"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => deleteGroup(group, e)}
                        className="p-1.5 text-gray-400 hover:bg-red-50 rounded-full transition"
                        title="מחק"
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
                      >
                        <CloseIcon size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
