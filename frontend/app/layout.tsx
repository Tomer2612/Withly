import './globals.css';
import type { Metadata } from 'next';
import { Noto_Serif_Hebrew, Assistant } from 'next/font/google';
import { cookies } from 'next/headers';
import { ClientProviders } from './components/ClientProviders';

interface JwtPayload {
  email?: string;
  sub?: string;
  exp?: number;
}

// Decode the JWT payload (no signature verify — purely for SSR's render
// decision; the API still verifies on every authenticated request).
function decodeJwt(token: string): JwtPayload | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const json = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

async function getInitialUser(): Promise<{ userId: string; email: string } | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  if (!accessToken) return null;
  const payload = decodeJwt(accessToken);
  if (!payload?.email || !payload.sub || !payload.exp || payload.exp * 1000 < Date.now()) {
    return null;
  }
  return { userId: payload.sub, email: payload.email };
}

const notoSerifHebrew = Noto_Serif_Hebrew({
  subsets: ['hebrew'],
  weight: ['400', '700'],
  variable: '--font-serif-hebrew',
});

const assistant = Assistant({
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Withly | הפלטפורמה המובילה בישראל לניהול קהילות',
    template: '%s | Withly',
  },
  description: 'Withly היא פלטפורמה שמרכזת תוכן, קורסים ואירועים במקום אחד. נהלו את הקהילה שלכם בצורה מסודרת, בלי מורכבות מיותרת, וצרו מקור הכנסה יציב מהעשייה שלכם.',
  keywords: ['קהילות', 'קורסים', 'לימודים', 'רשת חברתית', 'ישראל', 'community', 'courses'],
  authors: [{ name: 'Withly' }],
  creator: 'Withly',
  metadataBase: new URL('https://withly.co.il'),
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: 'https://withly.co.il',
    siteName: 'Withly',
    title: 'Withly | הפלטפורמה המובילה בישראל לניהול קהילות',
    description: 'Withly היא פלטפורמה שמרכזת תוכן, קורסים ואירועים במקום אחד. נהלו את הקהילה שלכם בצורה מסודרת, בלי מורכבות מיותרת, וצרו מקור הכנסה יציב מהעשייה שלכם.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Withly | הפלטפורמה המובילה בישראל לניהול קהילות',
    description: 'Withly היא פלטפורמה שמרכזת תוכן, קורסים ואירועים במקום אחד. נהלו את הקהילה שלכם בצורה מסודרת, בלי מורכבות מיותרת, וצרו מקור הכנסה יציב מהעשייה שלכם.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialUser = await getInitialUser();
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={` ${ assistant.className} ${ notoSerifHebrew.variable} text-right antialiased min-h-screen`} style={{ backgroundColor: '#F4F4F5' }} suppressHydrationWarning>
        <ClientProviders initialUser={initialUser}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
