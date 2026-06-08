'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteFooter from '../../components/SiteFooter';
import FormSelect from '../../components/FormSelect';
import { useUser } from '../../lib/UserContext';
import HypPaymentIframeModal from '../../components/HypPaymentIframeModal';
import ExistingCardConfirmModal from '../../components/ExistingCardConfirmModal';
import CardPickerModal from '../../components/CardPickerModal';
import { useDefaultPlan, useActivePlans, type Plan } from '../../lib/usePlan';

// Feature checkmark — self-contained 18px badge: light-green filled circle
// with a dark-green tick. (clipPath dropped: the paths sit inside the
// viewBox already, and a shared clip id would collide across instances.)
const CheckCircleIcon = ({ className = '' }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z"
      fill="#A7EA7B" stroke="#A7EA7B" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round"
    />
    <path d="M6.75 9L8.25 10.5L11.25 7.5" stroke="#163300" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface FAQ {
  question: string;
  answer: string;
}

// Feature rows shared by every plan. The transaction-commission row is
// appended per-plan, derived from that plan's commissionBasisPoints so the
// marketing copy can never drift from the rate actually billed.
const COMMON_FEATURES: string[] = [
  'קהילה אחת',
  'ללא הגבלת תוכן',
  'ללא הגבלת משתמשים',
  'דומיין מותאם',
];

// "940" → "9.4% עמלת עסקאות", "290" → "2.9%", "500" → "5%" (drop a
// trailing ".0" so round rates read cleanly).
const formatCommissionRow = (bps: number): string => {
  const pct = bps / 100;
  const text = bps % 100 === 0 ? String(pct) : pct.toFixed(1);
  return `${text}% עמלת עסקאות`;
};

// First-paint scaffold so the cards aren't blank before /api/plans
// resolves. Mirrors the seeded starter/pro rows.
const FALLBACK_PLANS: Plan[] = [
  { id: 'fallback-starter', slug: 'starter', name: 'Starter', monthlyPriceILS: 54, commissionBasisPoints: 940, trialLengthMonths: 1, isActive: true, isDefault: true, features: null },
  { id: 'fallback-pro', slug: 'pro', name: 'Pro', monthlyPriceILS: 164, commissionBasisPoints: 290, trialLengthMonths: 1, isActive: true, isDefault: false, features: null },
];

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
answer: 'בטח. יש לכם חודש התנסות בחינם שבו תוכלו להקים את הקהילה, לשחק עם הפיצ\'\'רים ולראות איך הכל עובד, ללא שום התחייבות.',
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

  const defaultPlan = useDefaultPlan();

  // Both plan cards (starter + pro), cheapest-first from the API.
  const activePlans = useActivePlans();
  const plansToRender = activePlans ?? FALLBACK_PLANS;

  // Which plan the owner clicked. Carried into checkout so the right plan
  // gets pinned on their account; null → falls back to the default plan.
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
  const selectedPlan = plansToRender.find((p) => p.slug === selectedPlanSlug) ?? null;

  // Drives the create-step price + payment modals. Reflects the picked plan
  // (default plan when nothing's selected yet).
  const plan = {
    price: selectedPlan?.monthlyPriceILS ?? defaultPlan?.monthlyPriceILS ?? 99,
  };

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

  // Card-picker state. On "המשך" we stage the pending row, then fetch the
  // user's wallet. Zero unexpired cards → straight to the iframe (legacy
  // path). One or more → show the confirm popup with the primary pre-
  // selected, with an option to switch via the picker.
  const [pickerView, setPickerView] = useState<'none' | 'confirm' | 'picker' | 'iframe'>('none');
  const [savedCards, setSavedCards] = useState<{
    id: string; cardLastFour: string; cardBrand: string;
    cardExpMonth: number | null; cardExpYear: number | null;
    isPrimary: boolean; createdAt: string;
  }[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [finalizing, setFinalizing] = useState(false);

  // Check for step + plan params on mount (e.g. returning from signup, which
  // carries the plan the user picked before they had an account).
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam === 'create') {
      setCurrentStep('create');
    }
    const planParam = searchParams.get('plan');
    if (planParam) {
      setSelectedPlanSlug(planParam);
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
        // Restore the plan they picked so the price + pinned plan stay right.
        if (pending.plan?.slug) setSelectedPlanSlug(pending.plan.slug);
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

  const handleSelectPlan = (slug: string) => {
    setSelectedPlanSlug(slug);
    if (!userEmail) {
      // Not logged in — carry the plan choice through signup so it survives
      // the round-trip back to ?step=create.
      router.push(`/signup?createCommunity=true&plan=${slug}`);
    } else {
      // Logged in - go to create step first (community details)
      setCurrentStep('create');
    }
  };

  // After entering community details: stage the data in a
  // PendingCommunityCreation row (NOT a real Community), then check the
  // user's wallet. Zero unexpired cards → open the HYP iframe directly
  // (legacy path). One or more → show the saved-card confirm popup; if
  // the user picks an existing card we finalize without ever opening the
  // iframe. The Community is only created on success — atomically, with
  // a card bound — so there is no window where a community exists
  // without payment.
  //
  // Backed by POST /communities/begin-checkout. The endpoint is upsert-
  // keyed on userId, so re-submitting overwrites any prior staging row.
  const handleContinueToPayment = async () => {
    if (!communityName.trim()) return;

    setCreatingCommunity(true);
    try {
      const [stageRes, walletRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/communities/begin-checkout`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: communityName,
            description: `קהילת ${communityName}`,
            topic: communityTopic || undefined,
            planSlug: selectedPlanSlug || undefined,
          }),
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/payment-methods`, {
          credentials: 'include',
        }),
      ]);
      if (!stageRes.ok) throw new Error('Failed to stage community checkout');
      const data = await stageRes.json();
      setPendingId(data.pendingId);

      const allCards: typeof savedCards = walletRes.ok ? await walletRes.json() : [];
      // Filter to unexpired + sort primary-first, newest-first.
      const now = new Date();
      const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
      const unexpired = allCards.filter(c => {
        if (c.cardExpMonth == null || c.cardExpYear == null) return true;
        return c.cardExpYear * 100 + c.cardExpMonth >= nowYM;
      });
      unexpired.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setSavedCards(unexpired);

      if (unexpired.length === 0) {
        setPickerView('iframe');
      } else {
        setSelectedCardId(unexpired[0].id);
        setPickerView('confirm');
      }
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
            חודש ראשון חינם, ולאחר מכן ₪{plan.price} בחודש.
            <br />
            תזכורת תישלח 3 ימים לפני החיוב, ניתן לבטל בכל עת.
          </p>
        </div>

        {/* Phase 3.3 — iframe-based card tokenization. Mounted on the
            create-step page so the user stays in flow. The Community row
            does not exist yet; backend creates it atomically on tokenize
            success using the pendingId in the Order field. HYP redirects
            parent to /communities/<id>/feed (welcome popup shows there). */}
        {pickerView === 'confirm' && user && pendingId && (
          <ExistingCardConfirmModal
            title={communityName}
            logoUrl={null}
            showAvatar={false}
            monthlyPrice={plan.price}
            selectedCard={(() => {
              const card = savedCards.find(c => c.id === selectedCardId) ?? savedCards[0];
              return {
                id: card.id,
                cardLastFour: card.cardLastFour,
                cardBrand: card.cardBrand,
              };
            })()}
            actionLabel="הקמת הקהילה"
            trialFirstMonthFree
            loading={finalizing}
            onCancel={() => setPickerView('none')}
            onSwitchCard={() => setPickerView('picker')}
            onConfirm={async () => {
              setFinalizing(true);
              try {
                const res = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL}/communities/finalize-with-existing-card`,
                  {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pendingId, paymentMethodId: selectedCardId }),
                  },
                );
                if (!res.ok) {
                  router.push('/pricing?card=error');
                  return;
                }
                const community = await res.json();
                router.push(`/communities/${community.id}/feed`);
              } catch {
                router.push('/pricing?card=error');
              } finally {
                setFinalizing(false);
              }
            }}
          />
        )}

        {pickerView === 'picker' && (
          <CardPickerModal
            cards={savedCards.map(c => ({
              id: c.id,
              cardLastFour: c.cardLastFour,
              cardBrand: c.cardBrand,
            }))}
            selectedId={selectedCardId}
            // No community exists yet on the new-community flow, so no "currently bound" tag.
            onCancel={() => setPickerView('none')}
            onSelect={(id) => {
              setSelectedCardId(id);
              setPickerView('confirm');
            }}
            onAddNew={() => setPickerView('iframe')}
          />
        )}

        {/* Phase 3.3 — iframe-based card tokenization. Mounted on the
            create-step page so the user stays in flow. The Community row
            does not exist yet; backend creates it atomically on tokenize
            success using the pendingId in the Order field. HYP redirects
            parent to /communities/<id>/feed (welcome popup shows there). */}
        {pickerView === 'iframe' && user && pendingId && (
          <HypPaymentIframeModal
            amount={Math.max(1, plan.price)}
            j5="J2"
            bof
            orderPrefix={`tokenize-newCommunity-${pendingId}`}
            clientName={user.name || user.email}
            email={user.email}
            userId={user.userId}
            title="הוספת אמצעי תשלום לקהילה"
            onClose={() => setPickerView('none')}
          />
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#F4F4F5' }} dir="rtl">
      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        {/* !important on size/weight: a global unlayered `h1 { font-size:
            2.5rem; font-weight:700 }` in globals.css would otherwise win
            over these Tailwind utilities (unlayered beats @layer). */}
        <h1 className="text-black mb-4 text-[40px]! sm:text-[56px]! font-semibold!">
          פשוט לבנות קהילה מנצחת
        </h1>
        <p style={{ color: 'var(--color-gray-8)', fontWeight: 400 }} className="text-[19px] sm:text-[21px]">
          נהלו את הקהילה שלכם בצורה מסודרת, בלי מורכבות מיותרת
        </p>
      </section>

      {/* Pricing Cards — starter + pro. Stack on mobile, side-by-side on md+. */}
      <section className="flex flex-col md:flex-row justify-center items-stretch gap-6 px-4 pb-16">
        {plansToRender.map((p) => {
          const isPro = p.slug === 'pro';
          // Card stroke: gray-4 for starter, light green for pro (2px so it
          // reads as a deliberate accent). Badge fill is lighter — gray-2 for
          // starter, light green for pro.
          const strokeColor = isPro ? 'var(--color-green-light)' : 'var(--color-gray-4)';
          const badgeBg = isPro ? 'var(--color-green-light)' : 'var(--color-gray-2)';
          const features = [...COMMON_FEATURES, formatCommissionRow(p.commissionBasisPoints)];
          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl border-2 flex flex-col w-full max-w-[280px]"
              style={{ borderColor: strokeColor, padding: '24px' }}
            >
              {/* Badge */}
              <div style={{ marginBottom: '20px' }}>
                <span
                  className="inline-block"
                  style={{
                    backgroundColor: badgeBg,
                    borderRadius: '8px',
                    padding: '4px 12px',
                    fontSize: '16px',
                    fontWeight: 400,
                    color: 'black',
                  }}
                >
                  {isPro ? 'Pro' : 'Starter'}
                </span>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1" style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '48px', fontWeight: 600, color: 'black', lineHeight: 1 }}>
                  {p.monthlyPriceILS}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--color-gray-8)' }}>
                  ₪ / לחודש
                </span>
              </div>

              {/* Features */}
              <div className="flex flex-col flex-1" style={{ gap: '12px', marginBottom: '20px' }}>
                {features.map((feature, fIndex) => (
                  <div key={fIndex} className="flex items-center gap-2">
                    <CheckCircleIcon className="flex-shrink-0" />
                    <span className="text-black" style={{ fontSize: '18px', fontWeight: 400 }}>{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button — same for both plans. Full width within the
                  card's 24px padding (so it sits 24px from each edge). */}
              <button
                onClick={() => handleSelectPlan(p.slug)}
                className="w-full bg-black text-white transition"
                style={{ borderRadius: '16px', padding: '14px 0', fontSize: '18px', fontWeight: 400 }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1A1A1A')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'black')}
              >
                נסו בחינם לחודש
              </button>
            </div>
          );
        })}
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
