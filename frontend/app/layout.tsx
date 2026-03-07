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
    default: 'Withly',
    template: '%s | Withly',
  },
  description: 'הצטרפו לקהילות מקצועיות, למדו מהמומחים הטובים ביותר, והתחברו עם אנשים בעלי תחומי עניין משותפים. Withly - הבית של הקהילות המובילות בישראל.',
  keywords: ['קהילות', 'קורסים', 'לימודים', 'רשת חברתית', 'ישראל', 'community', 'courses'],
  authors: [{ name: 'Withly' }],
  creator: 'Withly',
  metadataBase: new URL('https://withly.co.il'),
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: 'https://withly.co.il',
    siteName: 'Withly',
    title: 'Withly',
    description: 'הצטרפו לקהילות מקצועיות, למדו מהמומחים הטובים ביותר, והתחברו עם אנשים בעלי תחומי עניין משותפים.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Withly',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Withly',
    description: 'הצטרפו לקהילות מקצועיות, למדו מהמומחים הטובים ביותר, והתחברו עם אנשים בעלי תחומי עניין משותפים.',
    images: ['/og-image.png'],
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
