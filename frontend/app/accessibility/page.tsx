'use client';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function AccessibilityPage() {
  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      <SiteHeader />

      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black" style={{ fontSize: '3.5rem' }}>
          הצהרת נגישות
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ marginBottom: '2rem', color: '#52525B' }}>
          המחויבות שלנו לנגישות דיגיטלית
        </p>
      </section>

      {/* Content Section */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-black mb-4">מחויבות לנגישות</h2>
            <p className="leading-relaxed" style={{ color: '#52525B' }}>
              Withly מחויבת להנגיש את הפלטפורמה שלה לכלל המשתמשים, כולל אנשים עם מוגבלויות. 
              אנו פועלים לשפר באופן מתמיד את חווית השימוש עבור כולם, תוך יישום תקני הנגישות המקובלים.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-black mb-4">תקני נגישות</h2>
            <p className="leading-relaxed mb-4" style={{ color: '#52525B' }}>
              אנו שואפים לעמוד בדרישות תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), 
              התשע&quot;ג-2013, ובהנחיות WCAG 2.1 ברמה AA.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-black mb-4">התאמות נגישות באתר</h2>
            <ul className="list-disc list-inside space-y-2 mr-4" style={{ color: '#52525B' }}>
              <li>תמיכה בניווט מקלדת</li>
              <li>תמיכה בקוראי מסך</li>
              <li>ניגודיות צבעים מתאימה</li>
              <li>אפשרות להגדלת טקסט</li>
              <li>כותרות והיררכיה ברורה</li>
              <li>טקסט חלופי לתמונות</li>
              <li>טפסים נגישים עם תוויות ברורות</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-black mb-4">דפדפנים נתמכים</h2>
            <p className="leading-relaxed" style={{ color: '#52525B' }}>
              האתר תומך בגרסאות העדכניות של הדפדפנים הנפוצים: Chrome, Firefox, Safari, Edge.
              לחוויה מיטבית, מומלץ להשתמש בגרסה העדכנית ביותר של הדפדפן.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-black mb-4">נתקלתם בבעיה?</h2>
            <p className="leading-relaxed" style={{ color: '#52525B' }}>
              אם נתקלתם בבעיית נגישות באתר או שיש לכם הצעות לשיפור, נשמח לשמוע מכם. 
              ניתן לפנות אלינו באמצעות <a href="/contact" className="text-black underline hover:opacity-70">דף צור קשר</a> או 
              בדוא&quot;ל: tomer@withly.co.il או sean@withly.co.il
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-black mb-4">עדכון הצהרת הנגישות</h2>
            <p className="leading-relaxed" style={{ color: '#52525B' }}>
              הצהרה זו עודכנה לאחרונה בינואר 2026. 
              אנו מעדכנים את ההצהרה באופן תקופתי בהתאם לשינויים באתר ובתקנות הנגישות.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
