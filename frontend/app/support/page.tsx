'use client';

import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

interface FAQ {
  question: string;
  answer: React.ReactNode;
}

const faqs: FAQ[] = [
  {
    question: 'איך אני יוצר קהילה?',
    answer: 'יצירת קהילה מתבצעת בקלות ובמהירות. לוחצים על הכפתור הראשי בעמוד הבית, ממלאים כמה פרטים בסיסיים, והקהילה החדשה שלכם באוויר.',
  },
  {
    question: 'האם אפשר לנהל כמה קהילות במקביל?',
    answer: 'נכון לעכשיו, כל משתמש יכול לנהל קהילה אחת בלבד.',
  },
  {
    question: 'האם פתיחת קהילה עולה כסף?',
    answer: 'הקמת הקהילה מגיעה עם 3 חודשי ניסיון בחינם, ללא כל התחייבות, כדי שתוכלו להתרשם מכל הכלים. לאחר מכן, עלות התחזוקה היא 99 ש״ח בחודש, לצד עמלת סליקה של 5% בלבד על עסקאות שמבוצעות דרך הפלטפורמה.',
  },
  {
    question: 'אילו סוגי תכנים אני יכול להעלות לקהילה?',
    answer: 'הכלים שלנו מאפשרים לכם לרכז הכל במקום אחד: החל מפוסטים ודיונים בפיד הקהילה, דרך העלאת קורסים וסרטונים, ועד ליצירת יומן אירועים (לייבים או מפגשים פרונטליים).',
  },
  {
    question: 'איך חברים חדשים יכולים להצטרף לקהילה שלי?',
    answer: 'ברגע שהקהילה שלכם מוכנה, תוכלו לשתף קישור הרשמה ייעודי. משתמשים שיכנסו אליו יוכלו להירשם בקלות ולהתחיל להיות פעילים.',
  },
  {
    question: 'איך מתבצע התשלום של חברי הקהילה?',
    answer: 'התשלום מתבצע בצורה מאובטחת ונוחה ישירות דרך הפלטפורמה. חברי הקהילה יוכלו לרכוש מנוי חודשי, מבלי שתצטרכו לחבר מערכות סליקה חיצוניות.',
  },
  {
    question: 'האם כל הקהילות עולות כסף?',
    answer: 'בפלטפורמה תמצאו גם קהילות חינמיות לגמרי וגם קהילות בתשלום. מנהל הקהילה הוא זה שמחליט ומגדיר את תנאי ההצטרפות, כך שזה משתנה בהתאם לכל קהילה.',
  },
  {
    question: 'יש לי שאלות נוספות, איך אפשר ליצור קשר?',
    answer: <>אנחנו תמיד כאן בשבילכם! תוכלו לפנות אלינו בקלות דרך עמוד &quot;צור קשר&quot; באתר, או פשוט לשלוח לנו אימייל <a href="mailto:support@withly.co.il" className="text-black font-normal underline hover:opacity-70 transition">support@withly.co.il</a> ונשמח לעזור.</>,
  },
];

export default function SupportPage() {
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());

  const toggleFaq = (index: number) => {
    setOpenFaqs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <main className="min-h-screen" dir="rtl" style={{ backgroundColor: '#F4F4F5' }}>
      <SiteHeader />

      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black text-3xl md:text-5xl lg:text-[3.5rem]">
          שאלות ותשובות
        </h1>
      </section>

      {/* FAQ Section */}
      <section className="max-w-2xl mx-auto px-4 pb-16">
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white overflow-hidden transition"
              style={{ borderRadius: '16px', border: '1px solid #A1A1AA' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FCFCFC'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between text-right px-4 py-4"
              >
                <span className="font-medium text-black">{faq.question}</span>
                <span className={`transform transition-transform duration-300 ${openFaqs.has(index) ? 'rotate-45' : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M10 4.16669V15.8334" stroke="#6B7280" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.16669 10H15.8334" stroke="#6B7280" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              <div className={`grid transition-all duration-300 ease-in-out ${openFaqs.has(index) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="pb-4 text-black text-right px-4">
                    {faq.answer}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
