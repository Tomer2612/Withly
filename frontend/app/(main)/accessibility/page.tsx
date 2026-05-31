'use client';

import Link from 'next/link';
import SiteFooter from '../../components/SiteFooter';

export default function AccessibilityPage() {
  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black text-3xl md:text-5xl lg:text-[3.5rem]">
          הצהרת נגישות
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: '#52525B' }}>
          המחויבות שלנו לנגישות דיגיטלית
        </p>
        <p className="text-sm mt-4" style={{ marginBottom: '2rem', color: '#7A7A83' }}>
          עודכן לאחרונה: 27 במאי 2026
        </p>
      </section>

      {/* Intro */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-4">מבוא</h2>
          <p className="leading-relaxed" style={{ color: '#52525B' }}>
            הפלטפורמה מופעלת על ידי <strong>תומר שמחון ברעם</strong>, עוסק פטור שמספרו <strong>323115600</strong>. ב-Withly אנו רואים חשיבות במתן שירות שוויוני ונגיש לכלל המשתמשים, ופועלים להנגיש את הפלטפורמה הדיגיטלית שלנו בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013.
          </p>
        </div>
      </section>

      {/* 1. Digital Accessibility */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">1. נגישות דיגיטלית</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              אנו שואפים שהפלטפורמה שלנו תעמוד בדרישות התקן הישראלי לנגישות באינטרנט (ת"י 5568) ברמה AA, ובהנחיות WCAG 2.1 ברמה AA.
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>הפלטפורמה מותאמת לניווט באמצעות המקלדת.</li>
              <li>האתר נכתב בצורה המאפשרת תמיכה בתוכנות קוראות מסך.</li>
              <li>עיצוב הממשק מבוסס על ניגודיות טקסט גבוהה.</li>
              <li>כותרות והיררכיה ברורה.</li>
              <li>טפסים נגישים עם תוויות ברורות.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 2. Supported Browsers */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">2. דפדפנים נתמכים</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              האתר תומך בגרסאות העדכניות של הדפדפנים הנפוצים: Chrome, Firefox, Safari, Edge. לחוויה מיטבית, מומלץ להשתמש בגרסה העדכנית ביותר של הדפדפן.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Physical Accessibility */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">3. הסדרי נגישות פיזיים</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              Withly היא פלטפורמה אינטרנטית (שירות דיגיטלי) לחלוטין. אין לחברה משרדים המקבלים קהל, ולפיכך לא קיימים הסדרי נגישות פיזיים למבנים או קבלת קהל פרונטלית. כלל השירות, התמיכה והתקשורת מתבצעים באמצעים דיגיטליים.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Accessibility Limitations */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">4. סייגים לנגישות</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              מכיוון ש-Withly היא פלטפורמה מבוססת תוכן גולשים (UGC), חלק מהתכנים המועלים על ידי מנהלי קהילות או משתמשים אחרים עשויים שלא להיות נגישים באופן מלא (לדוגמה: העדר טקסט חלופי לתמונות שמעלים משתמשים, או תוכן וידאו ללא כתוביות). אנו עושים את מירב המאמצים לעודד מנהלי קהילות לפרסם תוכן נגיש, אך איננו יכולים להבטיח את נגישות כל התוכן שמועלה על ידי משתמשים.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Contact */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">5. יצירת קשר בנושא נגישות</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              אם נתקלת בבעיית נגישות כלשהי בפלטפורמה, נשמח מאוד לשמוע על כך כדי שנוכל לתקן ולשפר. ניתן לפנות אלינו דרך{' '}
              <Link href="/contact" className="underline hover:opacity-70" style={{ color: '#003233' }}>
                עמוד צרו קשר
              </Link>
              {' '}או ישירות בדוא"ל.
            </p>
            <p>
              <strong>איש קשר בנושא נגישות:</strong> תומר שמחון ברעם<br />
              <strong>דוא"ל לתמיכה ונגישות:</strong>{' '}
              <a href="mailto:support@withly.co.il" className="underline hover:opacity-70" style={{ color: '#003233' }}>
                support@withly.co.il
              </a>
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
