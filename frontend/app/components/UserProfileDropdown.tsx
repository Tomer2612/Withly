'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import UserIcon from './icons/UserIcon';
import SettingsIcon from './icons/SettingsIcon';
import LogoutIcon from './icons/LogoutIcon';
import { serverLogout } from '../lib/auth';

interface UserProfileDropdownProps {
  userEmail: string;
  userId: string | null;
  userProfile: { name?: string; profileImage?: string | null } | null;
  showOnlineIndicator?: boolean;
}

export default function UserProfileDropdown({
  userEmail,
  userId,
  userProfile,
  showOnlineIndicator = true,
}: UserProfileDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    // Tell the backend first so the refresh token gets revoked and the new
    // httpOnly cookies are cleared by Set-Cookie. Local cleanup runs after.
    await serverLogout();
    localStorage.removeItem('token');
    localStorage.removeItem('userProfileCache');
    document.cookie = 'auth-token=; path=/; max-age=0';
    window.location.href = '/';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative focus:outline-none"
      >
        <Avatar
          src={userProfile?.profileImage}
          name={userProfile?.name}
          email={userEmail}
          size="md"
          showOnlineIndicator={showOnlineIndicator}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown Menu */}
          <div className="absolute left-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 z-50" dir="rtl">
            <button
              onClick={() => {
                setIsOpen(false);
                if (userId) router.push(`/profile/${userId}`);
              }}
              className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2 rounded-lg"
            >
              <UserIcon className="w-4 h-4" />
              הפרופיל שלי
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/settings');
              }}
              className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2 rounded-lg"
            >
              <SettingsIcon className="w-4 h-4" />
              הגדרות
            </button>
            <div className="border-t border-gray-100 my-1 mx-1"></div>
            <button
              onClick={handleLogout}
              className="w-full text-right px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2 rounded-lg"
            >
              <LogoutIcon className="w-4 h-4" />
              התנתקות
            </button>
          </div>
        </>
      )}
    </div>
  );
}
