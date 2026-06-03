'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteFooter from '../../components/SiteFooter';
import FormSelect from '../../components/FormSelect';
import { useUser } from '../../lib/UserContext';
import HypPaymentIframeModal from '../../components/HypPaymentIframeModal';

// Checkmark Icon component
const CheckmarkIcon = ({ className = "w-3 h-2.5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 6 5" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M0.5625 2.0625L2.0625 3.5625L5.0625 0.5625" 
      stroke="currentColor" 
      strokeWidth="1.125" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

interface FAQ {
  question: string;
  answer: string;
}

interface PricingPlan {
  name: string;
  price: number;
  period: string;
  features: string[];
}

const plan: PricingPlan = {
  name: 'מנוי קהילה',
  price: 99,
  period: 'לחודש',
  features: [
    'מרחב קהילתי אחד',
    'משתמשים ללא הגבלה',
    'קורסים ותוכן ללא הגבלה',
    'יומן אירועים חכם',
    'סליקה ומנויים מובנים',
    '5% עמלת עסקאות',
  ],
};

const COMMUNITY_TOPICS = [
  'אנימציה',
  'אוכל, בישול ותזונה',
  'עזרה ותמיכה',
  'עיצוב גרפי',
  'עיצוב מותגים',
  'עריכת וידאו',
  'בריאות הנפש ופיתוח אישי',
  'גיימינג',
  'טיולים ולייףסטייל',
  'לימודים ואקדמיה',
  'מדיה, קולנוע וסדרות',
  'מדיה חברתית ותוכן ויזואלי',
  'ניהול פיננסי והשקעות',
  'ספרים וכתיבה',
  'ספורט ואורח חיים פעיל',
  'תחביבים',
  'יזמות ועסקים עצמאיים',
];

const faqs: FAQ[] = [
  {
    question: 'האם אפשר לנסות את המערכת לפני שמתחייבים?',
answer: 'בטח. יש לכם 3 חודשי התנסות בחינם שבהם תוכלו להקים את הקהילה, לשחק עם הפיצ\'\'רים ולראות איך הכל עובד, ללא שום התחייבות.',
  },
  {
    question: 'יש הגבלה על קורסים, וידאו או תכנים?',
    answer: 'לא, אין שום הגבלה. תוכלו להעלות כמה קורסים שתרצו, בלי לדאוג לשטח אחסון.',
  },
  {
    question: 'יש הגבלה על מספר החברים בקהילה?',
    answer: 'ממש לא. המטרה שלנו היא שתצמחו. הקהילה יכולה לגדול לאלפי משתמשים בלי שתצטרכו לשדרג מסלול או לחשוב על מדרגות תמחור.',
  },
  {
    question: 'האם אפשר לגבות תשלום מהקהילה שלי?',
    answer: 'הפלטפורמה כוללת מערכת סליקה מובנית המאפשרת לכם להציע מנוי חודשי על הצטרפות לקהילה.',
  },
  {
    question: 'האם צריך ידע טכני כדי להקים קהילה?',
    answer: 'ממש לא. בנינו את המערכת כך שתהיה פשוטה ואינטואיטיבית. פתיחת הקהילה, עיצוב המרחב והעלאת התכנים מתבצעים בקלות וללא צורך ברקע טכני.',
  },
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const userEmail = user?.email ?? null;
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());

  // Flow states - 'create' is the name+category popup; the iframe modal
  // handles payment (no separate 'payment' step page anymore).
  const [currentStep, setCurrentStep] = useState<'pricing' | 'create'>('pricing');
  const [communityName, setCommunityName] = useState('');
  const [communityTopic, setCommunityTopic] = useState('');
  const [creatingCommunity, setCreatingCommunity] = useState(false);
  // Set once begin-checkout stages the pending row. Reused if the user
  // closes the iframe modal so a re-click just reopens against the same
  // pendingId (upsert means it's overwritten anyway, but reusing avoids
  // an extra round-trip).
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);

  // Check for step parameter on mount (from signup redirect)
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam === 'create') {
      setCurrentStep('create');
    }
  }, [searchParams]);

  // Resume an in-flight checkout: if the user has a PendingCommunityCreation
  // row (e.g., they closed the iframe and came back), pre-fill the form so
  // they can finish where they left off.
  useEffect(() => {
    if (!userEmail || currentStep !== 'create') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/my-pending`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const pending = await res.json();
        if (cancelled || !pending) return;
        if (!communityName) setCommunityName(pending.name ?? '');
        if (!communityTopic && pending.topic) setCommunityTopic(pending.topic);
        setPendingId(pending.id);
      } catch {
        // Resume is a nice-to-have; failure means the user just re-fills.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, currentStep]);

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

  const handleSelectPlan = () => {
    if (!userEmail) {
      // Not logged in - redirect to signup with createCommunity flag
      router.push('/signup?createCommunity=true');
    } else {
      // Logged in - go to create step first (community details)
      setCurrentStep('create');
    }
  };

  // After entering community details: stage the data in a
  // PendingCommunityCreation row (NOT a real Community), then open the
  // iframe for card tokenization. The community row is only created on
  // tokenize success — atomically, with the card bound — so there is no
  // window where a community exists without payment.
  //
  // Backed by POST /communities/begin-checkout. The endpoint is upsert-
  // keyed on userId, so re-submitting overwrites any prior staging row.
  // On tokenize success backend redirects to /communities/<id>/manage.
  const handleContinueToPayment = async () => {
    if (!communityName.trim()) return;

    setCreatingCommunity(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/begin-checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: communityName,
          description: `קהילת ${communityName}`,
          topic: communityTopic || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to stage community checkout');
      const data = await res.json();
      setPendingId(data.pendingId);
      setShowCardModal(true);
    } catch (err) {
      console.error('Failed to begin checkout:', err);
    } finally {
      setCreatingCommunity(false);
    }
  };

  // Step 1: Create Community Details Modal (name + category)
  if (currentStep === 'create') {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4F4F5' }} dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-2">פרטי הקהילה</h2>
          <p className="text-center mb-8" style={{ color: '#71717A' }}>אפשר לערוך ולשנות את הכל גם אחרי ההקמה.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-right" style={{ color: '#3F3F46' }}>שם הקהילה</label>
              <input
                type="text"
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                style={{ borderColor: '#D0D0D4' }}
              />
            </div>
            
            <div>
              <FormSelect
                value={communityTopic}
                onChange={setCommunityTopic}
                label="קטגוריה"
                placeholder="בחר קטגוריה"
                options={COMMUNITY_TOPICS.map(topic => ({ value: topic, label: topic }))}
              />
            </div>
          </div>
          
          <button
            onClick={handleContinueToPayment}
            disabled={!communityName.trim() || creatingCommunity}
            className="w-full mt-8 bg-black text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {creatingCommunity ? 'יוצרים קהילה...' : 'המשך'}
          </button>

          <p className="text-center text-sm mt-4" style={{ color: '#71717A' }}>
            תזכורת תשלח במייל 3 ימים לפני סיום הניסיון. אפשר
            <br />
            לבטל בקליק דרך הגדרות הקהילה.
          </p>
        </div>

        {/* Phase 3.3 — iframe-based card tokenization. Mounted on the
            create-step page so the user stays in flow. The Community row
            does not exist yet; backend creates it atomically on tokenize
            success using the pendingId in the Order field. HYP redirects
            parent to /communities/<id>/manage?card=created. */}
        {showCardModal && user && pendingId && (
          <HypPaymentIframeModal
            amount={Math.max(1, plan.price)}
            j5="J2"
            bof
            orderPrefix={`tokenize-newCommunity-${pendingId}`}
            clientName={user.name || user.email}
            email={user.email}
            userId={user.userId}
            title="הוספת אמצעי תשלום לקהילה"
            onClose={() => setShowCardModal(false)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#F4F4F5' }} dir="rtl">
      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <h1 className="font-semibold text-black mb-4 text-3xl md:text-5xl lg:text-[3.5rem]">
          מחיר אחד. בלי הפתעות.
        </h1>
        <p className="text-lg" style={{ color: '#52525B' }}>
          פותחים קהילה ומתחילים בלי לחשוב על עלויות נוספות.
        </p>
      </section>

      {/* Pricing Card */}
      <section className="flex justify-center px-4 pb-16">
        <div
          className="bg-white rounded-2xl border p-8 flex flex-col w-full max-w-[300px]"
          style={{ minHeight: '380px', borderColor: '#A1A1AA' }}
        >
          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold text-black">{plan.price}</span>
              <span style={{ fontSize: '18px', color: '#3F3F46' }}>₪/{plan.period}</span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3 text-right flex-1" style={{ marginBottom: '1.5rem' }}>
            {plan.features.map((feature, fIndex) => (
              <div key={fIndex} className="flex items-center gap-2">
                <div 
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#A7EA7B' }}
                >
                  <CheckmarkIcon className="w-3 h-2.5 text-black" />
                </div>
                <span className="text-black" style={{ fontSize: '18px' }}>{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={handleSelectPlan}
            className="block w-full bg-black text-white py-3 font-normal transition"
            style={{ borderRadius: '16px' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1A1A1A'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
          >
            נסו חינם ל-3 חודשים
          </button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-2xl mx-auto px-4 pb-16">
        <h2 className="font-bold text-black text-center mb-8" style={{ fontSize: '40px' }}>
          שאלות נפוצות
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white border overflow-hidden transition"
              style={{ borderRadius: '16px', borderColor: '#A1A1AA' }}
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

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">טוען...</div>}>
      <PricingContent />
    </Suspense>
  );
}
