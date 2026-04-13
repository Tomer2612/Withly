'use client';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function TermsPage() {
  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      <SiteHeader />

      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black text-3xl md:text-5xl lg:text-[3.5rem]">
          תנאי שימוש
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ marginBottom: '2rem', color: '#52525B' }}>
          כל מה שצריך לדעת על השימוש בפלטפורמה
        </p>
      </section>

      {/* About Section */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-4">אודות Withly</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              <strong>Withly</strong> היא פלטפורמה ישראלית לבניית וניהול קהילות מקוונות. אנחנו מאמינים שכל אחד יכול ליצור קהילה משגשגת סביב התחום שהוא אוהב - בין אם זה גיימינג, בישול, ספורט, לימודים או כל נושא אחר.
            </p>
            <p>
              הפלטפורמה שלנו מציעה כלים פשוטים ועוצמתיים לניהול קהילות: פרסום תכנים, ניהול חברים, מערכת נקודות ותגמולים, קורסים, ועוד. המטרה שלנו היא לאפשר לכם להתמקד בבניית הקהילה שלכם בזמן שאנחנו דואגים לכל השאר.
            </p>
            <p>
              הוקמנו ב-2025 מתוך חזון לחבר אנשים עם תחומי עניין משותפים וליצור מרחבים דיגיטליים איכותיים בעברית.
            </p>
          </div>
        </div>
      </section>

      {/* Copyright & Legal Section */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">זכויות יוצרים ותנאי שימוש</h2>
          <div className="space-y-6 leading-relaxed" style={{ color: '#52525B' }}>
            <div>
              <h3 className="font-semibold text-black mb-2">זכויות יוצרים</h3>
              <p>
                כל הזכויות על הפלטפורמה, העיצוב, הקוד והתכנים שייכות ל-Withly © 2025. 
                אין להעתיק, לשכפל או להפיץ חלקים מהאתר ללא אישור בכתב מראש.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">תוכן משתמשים</h3>
              <p>
                המשתמשים שומרים על זכויות היוצרים לתכנים שהם מפרסמים בקהילות. 
                בפרסום תוכן באתר, המשתמש מעניק ל-Withly רישיון להציג את התוכן בפלטפורמה.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">אחריות</h3>
              <p>
                Withly אינה אחראית לתכנים שמפורסמים על ידי משתמשים. 
                אנו שומרים על הזכות להסיר תכנים שמפרים את תנאי השימוש או את החוק.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">פרטיות</h3>
              <p>
                אנו מחויבים להגנה על פרטיות המשתמשים. המידע האישי נשמר בצורה מאובטחת 
                ולא יועבר לצדדים שלישיים ללא הסכמה, למעט כנדרש על פי חוק.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">שימוש הוגן</h3>
              <p>
                המשתמשים מתחייבים לעשות שימוש הוגן בפלטפורמה, לכבד את שאר המשתמשים, 
                ולא לפרסם תכנים פוגעניים, לא חוקיים או מטעים.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-black mb-2">ביטולים והחזרים</h3>
              <p>
                ניתן לבטל מנוי בכל עת דרך הגדרות הקהילה. החזר כספי יינתן בהתאם למדיניות הביטולים 
                ובכפוף לחוק הגנת הצרכן.
              </p>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
