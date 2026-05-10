// Standalone HYP API key verification.
// Sends a SIGN request with a dummy Amount=10 and logs everything HYP returns.
// Use this to confirm HYP_MASOF / HYP_PASSP / HYP_KEY are valid before
// wiring the real backend routes.
//
// Run from project root:
//   node --env-file=.env scripts/test-hyp-sign.js
//
// Or, if you don't want to use --env-file, prefix the env vars yourself:
//   HYP_MASOF=... HYP_PASSP=... HYP_KEY=... node scripts/test-hyp-sign.js

const HYP_BASE = 'https://pay.hyp.co.il/p/';

const { HYP_MASOF, HYP_PASSP, HYP_KEY } = process.env;

if (!HYP_MASOF || !HYP_PASSP || !HYP_KEY) {
  console.error('Missing one or more env vars. Need: HYP_MASOF, HYP_PASSP, HYP_KEY');
  process.exit(1);
}

const params = new URLSearchParams({
  action: 'APISign',
  What: 'SIGN',
  Masof: HYP_MASOF,
  KEY: HYP_KEY,
  PassP: HYP_PASSP,
  Amount: '10',
  UTF8: 'True',
  UTF8out: 'True',
  Sign: 'True',
});

(async () => {
  console.log('--- Request ---');
  console.log('POST', HYP_BASE);
  // Mask secrets in echoed params so the log isn't a credential leak.
  const echoed = new URLSearchParams(params);
  echoed.set('KEY', `${HYP_KEY.slice(0, 4)}…(${HYP_KEY.length} chars)`);
  echoed.set('PassP', '***');
  console.log('Body:', echoed.toString());

  let res;
  try {
    res = await fetch(HYP_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (err) {
    console.error('\n--- Network error ---');
    console.error(err);
    process.exit(1);
  }

  const text = await res.text();
  console.log('\n--- HTTP status ---');
  console.log(res.status, res.statusText);
  console.log('\n--- Raw response body ---');
  console.log(text);

  // HYP returns a URL-encoded query string (e.g. "CCode=0&signature=..."),
  // so parse it back into an object for readability.
  console.log('\n--- Parsed params ---');
  const parsed = Object.fromEntries(new URLSearchParams(text).entries());
  console.log(parsed);

  // Quick verdict.
  // SIGN responses don't include CCode — that field only appears in VERIFY
  // responses. Success shape: signature present + action flipped to "pay".
  console.log('\n--- Verdict ---');
  if (parsed.signature && parsed.action === 'pay') {
    console.log('OK — got a signature back. Credentials look valid.');
    console.log(`Payment URL: ${HYP_BASE}?${text}`);
  } else if (parsed.CCode) {
    console.log(`FAIL — CCode=${parsed.CCode}. Check credentials / Masof setup.`);
  } else {
    console.log('UNEXPECTED — no signature in response. Inspect raw body above.');
  }
})();
