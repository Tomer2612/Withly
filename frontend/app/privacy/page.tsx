'use client';

import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      <SiteHeader />

      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black text-3xl md:text-5xl lg:text-[3.5rem]">
          מדיניות פרטיות
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: '#52525B' }}>
          כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם
        </p>
        <p className="text-sm mt-4" style={{ marginBottom: '2rem', color: '#7A7A83' }}>
          עודכן לאחרונה: ינואר 2026
        </p>
      </section>

      {/* Introduction */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-4">מבוא</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              ב-<strong>Withly</strong> אנו מחויבים להגן על פרטיות המשתמשים שלנו. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים, מאחסנים ומגנים על המידע האישי שלכם בעת השימוש בפלטפורמה שלנו.
            </p>
            <p>
              בשימוש בשירותי Withly, אתם מסכימים לאיסוף ושימוש במידע בהתאם למדיניות זו. אנו ממליצים לקרוא מדיניות זו בעיון ולפנות אלינו בכל שאלה.
            </p>
          </div>
        </div>
      </section>

      {/* Information We Collect */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">המידע שאנו אוספים</h2>
          <div className="space-y-6 leading-relaxed" style={{ color: '#52525B' }}>
            <div>
              <h3 className="font-semibold text-black mb-2">מידע שאתם מספקים לנו</h3>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li><strong>פרטי הרשמה:</strong> שם, כתובת אימייל, סיסמה (מוצפנת)</li>
                <li><strong>פרטי פרופיל:</strong> תמונת פרופיל, ביוגרפיה, תמונת רקע</li>
                <li><strong>תוכן:</strong> פוסטים, תגובות, הודעות שאתם מפרסמים בקהילות</li>
                <li><strong>פרטי תשלום:</strong> במידה ורכשתם מנוי (מעובד דרך ספק תשלומים מאובטח)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">מידע שנאסף אוטומטית</h3>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li><strong>נתוני שימוש:</strong> עמודים שנצפו, זמן שהייה, פעולות באתר</li>
                <li><strong>מידע טכני:</strong> כתובת IP, סוג דפדפן, מערכת הפעלה</li>
                <li><strong>קובצי Cookie:</strong> לשמירת העדפות והתחברות</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How We Use Information */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">כיצד אנו משתמשים במידע</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>אנו משתמשים במידע שנאסף למטרות הבאות:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>הפעלת הפלטפורמה ומתן השירותים</li>
              <li>יצירה וניהול החשבון שלכם</li>
              <li>עיבוד תשלומים ומנויים</li>
              <li>שליחת התראות והודעות רלוונטיות</li>
              <li>שיפור השירותים והחוויה באתר</li>
              <li>מניעת הונאות ושמירה על אבטחת המערכת</li>
              <li>עמידה בדרישות חוקיות</li>
            </ul>
            <p className="mt-4">
              <strong>שמירת מידע:</strong> אנו שומרים את המידע שלכם כל עוד החשבון פעיל. 
              לאחר מחיקת החשבון, המידע יימחק תוך 30 יום, למעט מידע שאנו מחויבים לשמור על פי חוק.
            </p>
          </div>
        </div>
      </section>

      {/* Information Sharing */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">שיתוף מידע עם צדדים שלישיים</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              אנו <strong>לא מוכרים</strong> את המידע האישי שלכם לצדדים שלישיים. 
              אנו עשויים לשתף מידע רק במקרים הבאים:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li><strong>ספקי שירות:</strong> חברות שמסייעות לנו בתפעול (אחסון, תשלומים, אימייל)</li>
              <li><strong>דרישה חוקית:</strong> כאשר נדרש על פי חוק או צו בית משפט</li>
              <li><strong>הגנה על זכויות:</strong> להגנה על הזכויות, הבטיחות או הרכוש שלנו או של אחרים</li>
              <li><strong>בהסכמתכם:</strong> כאשר נתתם הסכמה מפורשת</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Data Security */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">אבטחת מידע</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              אנו נוקטים באמצעי אבטחה מתקדמים להגנה על המידע שלכם:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>הצפנת סיסמאות באמצעות bcrypt</li>
              <li>תקשורת מוצפנת באמצעות HTTPS/SSL</li>
              <li>אחסון מאובטח בשרתים מוגנים (AWS)</li>
              <li>גישה מוגבלת למידע על בסיס הרשאות</li>
              <li>ניטור ומעקב אחר פעילות חשודה</li>
            </ul>
            <p>
              למרות מאמצינו, אין שיטת העברה או אחסון באינטרנט שהיא מאובטחת ב-100%. 
              אנו עושים כמיטב יכולתנו להגן על המידע שלכם.
            </p>
          </div>
        </div>
      </section>

      {/* Your Rights */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">הזכויות שלכם</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>בהתאם לחוק הגנת הפרטיות, יש לכם את הזכויות הבאות:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li><strong>גישה:</strong> לבקש עותק של המידע האישי שלכם</li>
              <li><strong>תיקון:</strong> לתקן מידע שגוי או לא מעודכן</li>
              <li><strong>מחיקה:</strong> לבקש מחיקת החשבון והמידע שלכם</li>
              <li><strong>ניוד:</strong> לקבל את המידע שלכם בפורמט נפוץ</li>
              <li><strong>התנגדות:</strong> להתנגד לעיבוד מסוים של המידע</li>
            </ul>
            <p>
              לממוש זכויות אלו, פנו אלינו דרך עמוד{' '}
              <Link href="/contact" className="hover:underline" style={{ color: '#003233' }}>צרו קשר</Link>
              {' '}או בדואר אלקטרוני.
            </p>
          </div>
        </div>
      </section>

      {/* Cookies */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">קובצי Cookie</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              אנו משתמשים בקובצי Cookie ו-Local Storage לצרכים הבאים:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li><strong>Cookie הכרחיים:</strong> לשמירת מצב ההתחברות שלכם</li>
              <li><strong>Cookie פונקציונליים:</strong> לשמירת העדפות (כמו מצב תצוגה)</li>
              <li><strong>Local Storage:</strong> לשמירת מטמון של נתוני משתמש לשיפור ביצועים</li>
            </ul>
            <p>
              ניתן לנהל את הגדרות ה-Cookie בדפדפן שלכם. שימו לב שחסימת Cookie עלולה לפגוע בפונקציונליות האתר.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
