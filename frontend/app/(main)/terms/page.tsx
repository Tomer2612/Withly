'use client';

import SiteFooter from '../../components/SiteFooter';

export default function TermsPage() {
  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black text-3xl md:text-5xl lg:text-[3.5rem]">
          תנאי שימוש
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: '#52525B' }}>
          כל מה שצריך לדעת על השימוש בפלטפורמה
        </p>
        <p className="text-sm mt-4" style={{ marginBottom: '2rem', color: '#7A7A83' }}>
          עודכן לאחרונה: 27 במאי 2026
        </p>
      </section>

      {/* About Section */}
      {/*
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-4">אודות Withly</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              <strong>Withly</strong> היא פלטפורמה ישראלית לבניית וניהול קהילות מקוונות, שהוקמה על ידי <strong>שון איסקוב</strong> ו-<strong>תומר שמחון ברעם</strong>. אנחנו מאמינים שכל אחד יכול ליצור קהילה משגשגת סביב התחום שהוא אוהב — בין אם זה גיימינג, בישול, ספורט, לימודים או כל נושא אחר.
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
      */}

      {/* Intro */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-4">מבוא</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              ברוכים הבאים ל-Withly. הפלטפורמה מופעלת על ידי <strong>תומר שמחון ברעם</strong>, עוסק פטור שמספרו <strong>323115600</strong> (להלן: "הפלטפורמה" או "אנחנו"). השימוש בפלטפורמה — לרבות גלישה, פתיחת חשבון, יצירת קהילות, העלאת תוכן, רכישת מנויים והשתתפות בפעילויות — כפוף לתנאי שימוש אלו.
            </p>
            <p>
              אנא קראו את התנאים בקפידה. בעצם ההרשמה או השימוש בפלטפורמה, אתם מסכימים לתנאים אלו במלואם.
            </p>
          </div>
        </div>
      </section>

      {/* 1. Registration */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">1. רישום וחשבון משתמש</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              <strong>1.1.</strong> כדי להשתמש בשירותי הפלטפורמה,יש ליצור חשבון ולספק פרטים מדויקים (שם מלא וכתובת דוא"ל).
            </p>
            <p>
              <strong>1.2.</strong> האחריות הבלעדית לשמירה על סודיות, פרטי ההתחברות ועל כל פעולה שתתבצע בחשבון, חלה עליך.
            </p>
            <p>
              <strong>1.3.</strong> השימוש בפלטפורמה מותר למי שכשיר לבצע פעולות משפטיות מחייבות. בעצם הרשמתך, ניתנת הצהרתך כי קיימת לך הזכות כדין להשתמש בשירות ולהתקשר בתנאים אלו.
            </p>
            <p>
              <strong>1.4.</strong> השימוש בפלטפורמה מותר לבני 13 ומעלה בלבד. משתמשים בני 13-18 מצהירים, בעצם השימוש, כי קיבלו את הסכמת ההורה או האפוטרופוס שלהם להשתמש בפלטפורמה ולהתקשר בתנאים אלו. רכישת מנויים בתשלום מותרת לבני 18 ומעלה, או למשתמשים צעירים יותר בכפוף להסכמת הורה. איננו מבצעים אימות גיל אקטיבי, אך נסיר חשבונות של משתמשים מתחת לגיל 13 אם נדע על קיומם.
            </p>
          </div>
        </div>
      </section>

      {/* 2. User Content */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">2. תוכן גולשים (User Generated Content)</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              <strong>2.1.</strong> הפלטפורמה מאפשרת למשתמשים לפרסם פוסטים, תגובות, קורסים ותכנים נוספים.
            </p>
            <p>
              <strong>2.2.</strong> המשתמש שומר על זכויות הקניין הרוחני בתוכן שלו, אך מעניק ל-Withly רישיון עולמי, לא בלעדי וחינמי להציג, להפיץ ולהשתמש בתוכן לצורך הפעלת הפלטפורמה.
            </p>
            <p>
              <strong>2.3.</strong> חל איסור מוחלט לפרסם תוכן פוגעני, אלים, מפר זכויות יוצרים, לשון הרע, ספאם, או כל תוכן העובר על החוק. אנו שומרים את הזכות להסיר תוכן מפר ולחסום משתמשים.
            </p>
            <p>
              <strong>2.4.</strong> Withly אינה אחראית לתכנים שמפורסמים על ידי משתמשים, ואינה בודקת תכנים מראש. האחריות על התוכן חלה במלואה על המשתמש שפרסם אותו.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Payments */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">3. תשלומים ומדיניות ביטולים</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              <strong>3.1.</strong> רכישת מנויים או שירותים בתשלום מבוצעת באמצעות ספק סליקה חיצוני מאובטח (HYP). Withly אינה אוספת או שומרת את פרטי כרטיס האשראי או תעודת הזהות שלך בשרתיה — אנו מקבלים מספק הסליקה אך ורק אסימון (Token) מזהה ואישור עסקה.
            </p>
            <p>
              <strong>3.2.</strong> השירותים בקהילות ניתנים לרוב במודל של מנוי חודשי מתחדש. משתמש רשאי לבטל את המנוי שלו בכל עת דרך החשבון האישי, ללא צורך ביצירת קשר עם התמיכה.
            </p>
            <p>
              <strong>3.3.</strong> במקרה של ביטול מנוי, הביטול ייכנס לתוקף בסוף מחזור החיוב הנוכחי. המשתמש ימשיך לקבל גישה מלאה לתכני הקהילה עד סוף החודש שעבורו שילם, ולאחר מכן הגישה תופסק והחיובים העתידיים ייעצרו. לא יינתנו החזרים כספיים יחסיים (Pro-rata) בגין ביטול שבוצע באמצע מחזור חיוב, אלא במקרים בהם החוק מחייב זאת.
            </p>
            <p>
              <strong>3.4.</strong> זכות הביטול לפי חוק הגנת הצרכן, התשמ"א-1981, שמורה לצרכנים בהתאם להוראות החוק.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Limitation of Liability */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">4. הגבלת אחריות</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              <strong>4.1.</strong> הפלטפורמה מסופקת כמות שהיא (AS IS). אנו לא מבטיחים שהשירות יהיה חסין מתקלות, שגיאות או הפרעות, או שיעמוד בכל ציפייה ספציפית של המשתמש.
            </p>
            <p>
              <strong>4.2.</strong> Withly לא תהיה אחראית לכל נזק עקיף או תוצאתי שייגרם כתוצאה משימוש בפלטפורמה, לרבות אובדן נתונים, אובדן רווחים או נזק למוניטין.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Copyright Takedown */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">5. הסרת תוכן מפר זכויות יוצרים</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              <strong>5.1.</strong> על מנת לדווח על תוכן המפר זכויות יוצרים,שלך או של אחרים, יש לפנות אלינו במייל לכתובת <a href="mailto:support@withly.co.il" className="underline hover:opacity-70" style={{ color: '#003233' }}>support@withly.co.il</a> וכלול בפנייתך:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>קישור מדויק לתוכן המפר.</li>
              <li>תיאור היצירה המקורית שלטענתך הופרה.</li>
              <li>הוכחת בעלות על היצירה המקורית (קישור, צילום מסך, וכו').</li>
              <li>פרטי יצירת קשר שלך (שם מלא, דוא"ל).</li>
              <li>הצהרה בתום לב כי השימוש בתוכן אינו מורשה על ידי בעל הזכויות.</li>
            </ul>
            <p>
              <strong>5.2.</strong> נבחן את הפנייה ונשיב לה תוך 14 ימי עסקים. במידה ונמצא כי התוכן אכן מפר, נסיר אותו מהפלטפורמה ונודיע על כך הן לפונה והן למשתמש שפרסם אותו.
            </p>
            <p>
              <strong>5.3.</strong> משתמש שתוכנו הוסר רשאי להגיש לנו פנייה נגדית אם הוא סבור שההסרה נעשתה בטעות. אנו שומרים את הזכות להפעיל שיקול דעת בכל מחלוקת.
            </p>
            <p>
              <strong>5.4.</strong> שימוש לרעה בהליך זה (פניות כוזבות) עלול להוביל לחסימת חשבון.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Changes & Termination */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">6. שינויים וסיום התקשרות</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              אנו שומרים לעצמנו את הזכות לעדכן תנאים אלו מעת לעת. שינויים מהותיים יפורסמו בעמוד זה. המשך השימוש בפלטפורמה לאחר העדכון מהווה הסכמה לתנאים החדשים.
            </p>
            <p>
              אנו רשאים להפסיק את ההתקשרות עם משתמש ולחסום את גישתו לפלטפורמה במקרה של הפרת תנאי שימוש אלו או הפרת החוק.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Jurisdiction */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid #E1E1E2' }}>
          <h2 className="text-2xl font-bold text-black mb-6">7. דין וסמכות שיפוט</h2>
          <div className="space-y-4 leading-relaxed" style={{ color: '#52525B' }}>
            <p>
              על תנאי שימוש אלו והשימוש בפלטפורמה יחולו דיני מדינת ישראל בלבד. סמכות השיפוט הבלעדית בכל מחלוקת הנוגעת לתנאים אלו או לשימוש בפלטפורמה נתונה לבתי המשפט המוסמכים בעיר תל אביב-יפו.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
