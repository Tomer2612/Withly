'use client';

import CreditCardIcon from './icons/CreditCardIcon';
import CalendarIcon from './icons/CalendarIcon';
import LockIcon from './icons/LockIcon';

// Single source of truth for card-entry inputs + validation, used by:
//   - UpdateCardModal (community billing card update)
//   - settings Add Card modal (user-level saved cards)
//   - pricing page checkout
//   - community preview page (paid join flow)
// Each call site owns the surrounding chrome (modal/page) and submit
// handler; this component only renders the three fields and the live
// inline error text. Helpers below are exported so parents can disable
// their submit button with the same logic.

export interface CardErrors {
  number?: string;
  expiry?: string;
  cvv?: string;
}

export const validateCard = (
  cardNumber: string,
  cardExpiry: string,
  cardCvv: string,
): CardErrors => {
  const errors: CardErrors = {};

  if (cardNumber.length > 0 && cardNumber.length < 16) {
    errors.number = `חסרות ${16 - cardNumber.length} ספרות`;
  }

  if (cardExpiry.length > 0 && cardExpiry.length < 5) {
    errors.expiry = 'פורמט: MM/YY';
  } else if (cardExpiry.length === 5) {
    const [m, y] = cardExpiry.split('/').map(Number);
    if (m < 1 || m > 12) {
      errors.expiry = 'חודש לא תקין';
    } else {
      const now = new Date();
      const cm = now.getMonth() + 1;
      const cy = now.getFullYear() % 100;
      if (y < cy || (y === cy && m < cm)) {
        errors.expiry = 'הכרטיס פג תוקף';
      }
    }
  }

  if (cardCvv.length > 0 && cardCvv.length < 3) {
    errors.cvv = `חסרות ${3 - cardCvv.length} ספרות`;
  }

  return errors;
};

export const isCardComplete = (
  cardNumber: string,
  cardExpiry: string,
  cardCvv: string,
): boolean => {
  if (cardNumber.length !== 16) return false;
  if (cardExpiry.length !== 5) return false;
  if (cardCvv.length !== 3) return false;
  const errors = validateCard(cardNumber, cardExpiry, cardCvv);
  return !errors.number && !errors.expiry && !errors.cvv;
};

interface CreditCardFormProps {
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  onCardNumberChange: (v: string) => void;
  onCardExpiryChange: (v: string) => void;
  onCardCvvChange: (v: string) => void;
}

export default function CreditCardForm({
  cardNumber,
  cardExpiry,
  cardCvv,
  onCardNumberChange,
  onCardExpiryChange,
  onCardCvvChange,
}: CreditCardFormProps) {
  const errors = validateCard(cardNumber, cardExpiry, cardCvv);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCardNumberChange(e.target.value.replace(/\D/g, '').slice(0, 16));
  };

  // Auto-insert "/" after MM digits while typing forward (preserve while
  // deleting). Mirrors the behavior the inline forms had everywhere.
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const rawValue = newValue.replace(/\D/g, '').slice(0, 4);
    if (rawValue.length > 2) {
      onCardExpiryChange(rawValue.slice(0, 2) + '/' + rawValue.slice(2));
    } else if (rawValue.length === 2 && newValue.length > cardExpiry.length) {
      onCardExpiryChange(rawValue + '/');
    } else {
      onCardExpiryChange(rawValue);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCardCvvChange(e.target.value.replace(/\D/g, '').slice(0, 3));
  };

  const inputBase =
    'w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black';

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <label className="block text-sm font-medium mb-2 text-right" style={{ color: '#3F3F46' }}>
          מספר כרטיס
        </label>
        <div className="relative">
          <input
            type="text"
            value={cardNumber}
            onChange={handleNumberChange}
            className={inputBase}
            style={{ borderColor: errors.number ? '#B3261E' : '#D0D0D4' }}
          />
          <CreditCardIcon
            className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#A1A1AA]"
          />
        </div>
        {errors.number && (
          <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{errors.number}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-right" style={{ color: '#3F3F46' }}>
            תוקף
          </label>
          <div className="relative">
            <input
              type="text"
              value={cardExpiry}
              onChange={handleExpiryChange}
              className={inputBase}
              style={{ borderColor: errors.expiry ? '#B3261E' : '#D0D0D4' }}
            />
            <CalendarIcon
              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A1A1AA]"
            />
          </div>
          {errors.expiry && (
            <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{errors.expiry}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-right" style={{ color: '#3F3F46' }}>
            CVV
          </label>
          <div className="relative">
            <input
              type="text"
              value={cardCvv}
              onChange={handleCvvChange}
              className={inputBase}
              style={{ borderColor: errors.cvv ? '#B3261E' : '#D0D0D4' }}
            />
            <LockIcon
              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#A1A1AA]"
            />
          </div>
          {errors.cvv && (
            <p className="text-sm mt-1" style={{ color: '#B3261E' }}>{errors.cvv}</p>
          )}
        </div>
      </div>
    </div>
  );
}
