// Mirrors what HypService.signPayment() sends, so we can verify the
// real /payments/create-payment route will return a working URL — without
// having to boot the backend and JWT-auth a request.
//
// Run: node --env-file=.env scripts/test-hyp-create-payment.js

const HYP_BASE = 'https://pay.hyp.co.il/p/';
const { HYP_MASOF, HYP_PASSP, HYP_KEY } = process.env;

if (!HYP_MASOF || !HYP_PASSP || !HYP_KEY) {
  console.error('Missing HYP_MASOF / HYP_PASSP / HYP_KEY in env.');
  process.exit(1);
}

// Same defaults the service uses, plus dummy user details.
const params = new URLSearchParams({
  action: 'APISign',
  What: 'SIGN',
  Masof: HYP_MASOF,
  KEY: HYP_KEY,
  PassP: HYP_PASSP,
  Amount: '99',
  Coin: '1',
  PageLang: 'HEB',
  ClientName: 'Test User',
  email: 'test@example.com',
  Order: 'test-order-001',
  Info: 'userId:cmiiw2wp20000i89wg3zt0kp7',
  UTF8: 'True',
  UTF8out: 'True',
  Sign: 'True',
});

(async () => {
  const res = await fetch(HYP_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(text).entries());

  console.log('--- HTTP status ---');
  console.log(res.status, res.statusText);
  console.log('\n--- Parsed response ---');
  console.log(parsed);

  if (parsed.signature && parsed.action === 'pay') {
    console.log('\n--- OK ---');
    console.log('Payment URL:');
    console.log(`${HYP_BASE}?${text}`);
  } else if (parsed.CCode) {
    console.log(`\n--- FAIL — CCode=${parsed.CCode} ---`);
  } else {
    console.log('\n--- UNEXPECTED ---');
    console.log('Raw body:', text);
  }
})();
