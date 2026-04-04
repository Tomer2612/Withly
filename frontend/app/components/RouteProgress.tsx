'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Listen for link clicks to start progress immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Skip if navigation was blocked by unsaved-changes guard
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (anchor) {
        const href = anchor.getAttribute('href');
        // Only trigger for internal navigation links
        if (href && href.startsWith('/') && !href.startsWith('//') && !anchor.hasAttribute('download')) {
          const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
          // Don't trigger if same page or hash link
          if (href !== currentPath && !href.startsWith('#')) {
            setLoading(true);
            setProgress(10);
          }
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname, searchParams]);

  // Progress animation while loading
  useEffect(() => {
    if (!loading) return;

    const timer1 = setTimeout(() => setProgress(30), 100);
    const timer2 = setTimeout(() => setProgress(50), 300);
    const timer3 = setTimeout(() => setProgress(70), 600);
    const timer4 = setTimeout(() => setProgress(85), 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [loading]);

  // Complete progress when route actually changes
  useEffect(() => {
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent pointer-events-none">
      <div
        className="h-full shadow-lg"
        style={{
          width: `${progress}%`,
          opacity: loading ? 1 : 0,
          transition: 'width 0.2s ease-out, opacity 0.2s ease-out',
          backgroundColor: '#A7EA7B',
          boxShadow: '0 0 10px rgba(167, 234, 123, 0.5)',
        }}
      />
    </div>
  );
}
