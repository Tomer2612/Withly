'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { jwtDecode } from 'jwt-decode';
import WithlyLogo from './icons/WithlyLogo';
import NotificationBell from './NotificationBell';
import { MessagesBell } from './ChatWidget';
import UserProfileDropdown from './UserProfileDropdown';

interface JwtPayload {
  email: string;
  sub: string;
  iat: number;
  exp: number;
}

interface SiteHeaderProps {
  // Optional: override the default nav links
  hideNavLinks?: boolean;
  // Optional: hide login/signup buttons
  hideAuthButtons?: boolean;
}

export default function SiteHeader({ hideNavLinks = false, hideAuthButtons = false }: SiteHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; profileImage?: string | null } | null>(null);

  useEffect(() => {
    setMounted(true);

    const clearSession = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('userProfileCache');
      document.cookie = 'auth-token=; path=/; max-age=0';
      setUserEmail(null);
      setUserId(null);
      setUserProfile(null);
      // Redirect to login unless already on login/signup (avoid infinite loop)
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/signup') {
        window.location.href = '/login?expired=true';
      }
    };

    const token = localStorage.getItem('token');
    if (token && token.split('.').length === 3) {
      try {
        const decoded = jwtDecode<JwtPayload>(token);

        // Check if token is expired — redirect to login
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          clearSession();
          return;
        }

        setUserEmail(decoded.email);
        setUserId(decoded.sub);

        // Read cached profile immediately
        const cached = localStorage.getItem('userProfileCache');
        if (cached) {
          try { setUserProfile(JSON.parse(cached)); } catch {}
        }

        // Fetch fresh user profile and validate token server-side
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            if (res.status === 401) {
              clearSession();
              return null;
            }
            return res.ok ? res.json() : null;
          })
          .then((data) => {
            if (data) {
              const profile = { name: data.name, profileImage: data.profileImage };
              setUserProfile(profile);
              localStorage.setItem('userProfileCache', JSON.stringify(profile));
            }
          })
          .catch(console.error);
      } catch (e) {
        console.error('Invalid token:', e);
        clearSession();
      }
    } else if (token) {
      // Malformed token
      clearSession();
    }
  }, []);

  return (
    <header dir="rtl" className="flex items-center justify-between px-8 py-4 bg-white border-b h-[72px]" style={{ borderColor: '#E1E1E2' }}>
      <Link href="/" className="flex items-center gap-2 text-xl font-bold text-black hover:opacity-75 transition">
        Withly
        <WithlyLogo size={28} />
      </Link>
      
      <div className="flex gap-6 items-center">
        {/* Nav Links */}
        {!hideNavLinks && (
          <>
            <Link href="/pricing" className="text-black hover:opacity-70 transition text-[18px] font-normal">
              מחירון
            </Link>
            <Link href="/support" className="text-black hover:opacity-70 transition text-[18px] font-normal">
              שאלות ותשובות
            </Link>
            <Link href="/contact" className="text-black hover:opacity-70 transition text-[18px] font-normal">
              צרו קשר
            </Link>
          </>
        )}

        {/* Auth Section */}
        {!mounted ? (
          <div className="w-10 h-10" />
        ) : !userEmail ? (
          !hideAuthButtons && (
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="border-2 border-black text-black px-6 py-2 rounded-lg font-semibold hover:bg-black hover:text-white transition"
              >
                כניסה
              </Link>
              <Link
                href="/signup"
                className="bg-black text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition border-2 border-black"
              >
                הרשמה
              </Link>
          </div>
          )
        ) : (
          <div className="flex items-center gap-3">
            <MessagesBell />
            <NotificationBell />
            <UserProfileDropdown
              userEmail={userEmail}
              userId={userId}
              userProfile={userProfile}
            />
          </div>
        )}
      </div>
    </header>
  );
}
