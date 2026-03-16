// @ts-ignore
import './globals.css';
import type { Metadata } from 'next';
import { Noto_Serif_Hebrew, Assistant } from 'next/font/google';
import { ClientProviders } from './ClientProviders';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={` ${ assistant.className} ${ notoSerifHebrew.variable} text-right antialiased min-h-screen`} style={{ backgroundColor: '#F4F4F5' }} suppressHydrationWarning>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
