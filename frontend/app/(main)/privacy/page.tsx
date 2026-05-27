'use client';

import Link from 'next/link';
import SiteFooter from '../../components/SiteFooter';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black text-3xl md:text-5xl lg:text-[3.5rem]">
          מדיניות פרטיות
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: '#52525B' }}>
          כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם
        </p>
        <p className="text-sm mt-4" style={{ marginBottom: '2rem', color: '#7A7A83' }}>
          עודכן לאחרונה: 27 במאי 2026
        </p>
      </section>

      {/* Introduction */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-4">מבוא</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              ב-<strong>Withly</strong> הפרטיות שלך חשובה לנו. מדיניות זו מסבירה איזה מידע אנו אוספים, כיצד אנו משתמשים בו, וכיצד אנו מגנים עליו.
            </p>
            <p>
              הפלטפורמה מופעלת על ידי <strong>תומר שמחון ברעם</strong>, עוסק פטור שמספרו <strong>323115600</strong>. בשימוש בשירותי Withly, אתם מסכימים לאיסוף ושימוש במידע בהתאם למדיניות זו.
            </p>
          </div>
        </div>
      </section>

      {/* 1. Information We Collect */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">1. מידע שאנו אוספים</h2>
          <div className="space-y-6 leading-relaxed" style={{ color: '#52525B' }}>
            <div>
              <h3 className="font-semibold text-black mb-2">1.1. מידע שאתם מספקים לנו ישירות</h3>
              <p>
                בעת ההרשמה, אנו אוספים את שמך המלא וכתובת הדוא"ל שלך. בנוסף, אם תבחר להוסיף, אנו שומרים תמונת פרופיל, ביוגרפיה, ותמונת רקע. כמו כן, התוכן שאתה מפרסם בפלטפורמה (פוסטים, תגובות, קורסים) נשמר כחלק משירותי הפלטפורמה.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">1.2. מידע תשלומים</h3>
              <p>
                כאשר מתבצע תשלום, פרטי האשראי ומספר תעודת הזהות שלך מעובדים על ידי ספק הסליקה החיצוני שלנו (HYP). Withly <strong>אינה שומרת</strong> את פרטי כרטיס האשראי או תעודת הזהות שלך בשרתיה, אלא מקבלת מספק הסליקה אך ורק אסימון (Token) מזהה ואישור עסקה.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">1.3. Cookies וטכנולוגיות שמירה מקומית</h3>
              <p>
                איננו משתמשים בכלי אנליטיקס חיצוניים או בכלי מעקב למטרות פרסום או פרופיילינג של משתמשים (כגון Google Analytics, Meta Pixel וכדומה). אנו משתמשים בטכנולוגיות שמירה מקומיות (Cookies ו-Local Storage) למטרה טכנית הכרחית אחת: להשאיר אותך מחובר לחשבונך (Logged in) למשך 30 ימים, ולשמור העדפות פונקציונליות (כגון מצב תצוגה).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">1.4. לוגים טכניים בשרת</h3>
              <p>
                ייתכן ונאספים לוגים טכניים מינימליים בשרתי האחסון שלנו (כגון כתובת IP וסוג דפדפן בעת הבקשה) לצרכי אבטחה, איתור תקלות ועמידה בדרישות החוק. לוגים אלו אינם משמשים לפרופיילינג שיווקי ונשמרים לתקופה קצרה.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How We Use Information */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">2. כיצד אנו משתמשים במידע</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>אנו משתמשים במידע אך ורק כדי:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>לספק, לתחזק ולתפעל את שירותי הפלטפורמה.</li>
              <li>להפעיל פיצ'רים חברתיים כגון טבלת המובילים (Leaderboard).</li>
              <li>לעבד תשלומים ומנויים באמצעות ספק הסליקה.</li>
              <li>לשלוח דוא"ל טכני ותפעולי (קבלות על תשלום, שחזור סיסמה, התראות על חשבונך).</li>
              <li>למנוע הונאות ולשמור על אבטחת המערכת.</li>
              <li>לעמוד בדרישות חוקיות.</li>
            </ul>
            <p className="mt-4">
              <strong>Withly אינה שולחת דיוור שיווקי או ניוזלטרים.</strong>
            </p>
            <p>
              <strong>שמירת מידע:</strong> אנו שומרים את המידע שלך כל עוד החשבון פעיל. לאחר מחיקת החשבון, המידע יימחק תוך 30 יום, למעט מידע שאנו מחויבים לשמור על פי חוק.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Sharing */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">3. שיתוף המידע שלך</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              Withly <strong>אינה מוכרת</strong> את המידע האישי שלך לצדדים שלישיים. אנו נשתף מידע רק במקרים הבאים:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li><strong>ספקי שירות טכניים</strong> המסייעים לנו להפעיל את הפלטפורמה (שרתי אחסון, ספק הסליקה HYP, ספק שליחת מיילים תפעוליים).</li>
              <li><strong>דרישה חוקית</strong> או צו בית משפט.</li>
              <li><strong>הגנה על זכויות</strong> — להגנה על הזכויות, הבטיחות או הרכוש שלנו או של אחרים.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Your Rights */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">4. הזכויות שלך</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>בהתאם לחוק הגנת הפרטיות, יש לך את הזכויות הבאות:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li><strong>גישה:</strong> לבקש לעיין במידע האישי שאנו מחזיקים עליך.</li>
              <li><strong>תיקון:</strong> לתקן מידע שגוי או לא מעודכן.</li>
              <li><strong>מחיקה:</strong> לבקש מחיקת החשבון והמידע שלך.</li>
              <li><strong>ניוד:</strong> לקבל את המידע שלך בפורמט נפוץ.</li>
            </ul>
            <p>
              לממוש זכויות אלו, פנה אלינו דרך עמוד{' '}
              <Link href="/contact" className="underline hover:opacity-70" style={{ color: '#003233' }}>צרו קשר</Link>
              {' '}או בדוא"ל לכתובת <a href="mailto:support@withly.co.il" className="underline hover:opacity-70" style={{ color: '#003233' }}>support@withly.co.il</a>. נשיב לבקשתך תוך 30 ימים מקבלתה, ולכל המאוחר בהתאם לדרישות חוק הגנת הפרטיות.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Security */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">5. אבטחת מידע</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>אנו נוקטים באמצעי אבטחה מתקדמים להגנה על המידע שלך:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>הצפנת סיסמאות באמצעות bcrypt.</li>
              <li>תקשורת מוצפנת באמצעות HTTPS/SSL.</li>
              <li>אחסון מאובטח בשרתים מוגנים.</li>
              <li>גישה מוגבלת למידע על בסיס הרשאות.</li>
            </ul>
            <p>
              למרות מאמצינו, אין שיטת העברה או אחסון באינטרנט שהיא מאובטחת ב-100%. אנו עושים כמיטב יכולתנו להגן על המידע שלך.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Storage Location */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">6. מיקום אחסון המידע</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              המידע שלך מאוחסן בשרתי <strong>Amazon Web Services (AWS)</strong> באזור ישראל (תל אביב, <code>il-central-1</code>). המידע אינו מועבר אל מחוץ למדינת ישראל במהלך הפעלת הפלטפורמה הרגילה.
            </p>
            <p>
              ספקי שירות נלווים (כגון ספק הסליקה HYP וספק שליחת מיילים תפעוליים) עשויים לעבד מידע מסוים בשרתיהם, בהתאם למדיניות הפרטיות שלהם ולחוק.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
