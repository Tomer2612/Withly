'use client';

import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer dir="rtl" className="py-6" style={{ backgroundColor: '#F4F4F5' }}>
      <div className="flex flex-col items-center gap-4">
        {/* Navigation Links */}
        <nav className="flex items-center gap-4 text-[18px]">
          <Link href="/pricing" className="text-black hover:opacity-70 transition font-normal">
            מחירון
          </Link>
          <Link href="/support" className="text-black hover:opacity-70 transition font-normal">
            שאלות ותשובות
          </Link>
          <Link href="/contact" className="text-black hover:opacity-70 transition font-normal">
            צרו קשר
          </Link>
          <span className="text-[#D0D0D4]">|</span>
          <Link href="/terms" className="text-black hover:opacity-70 transition font-normal">
            תנאי שימוש
          </Link>
          <Link href="/privacy" className="text-black hover:opacity-70 transition font-normal">
            מדיניות פרטיות
          </Link>
          <Link href="/accessibility" className="text-black hover:opacity-70 transition font-normal">
            הצהרת נגישות
          </Link>
        </nav>

        {/* Copyright */}
        <p className="text-[18px] text-[#7A7A83]">
         זכויות יוצרים - כל הזכויות שמורות ל{new Date().getFullYear()} © Withly    
        </p>
      </div>
    </footer>
  );
}
