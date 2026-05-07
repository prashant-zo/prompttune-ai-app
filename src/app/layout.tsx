// src/app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import type { Metadata, Viewport } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  applicationName: 'PromptTune',
  title: {
    default: 'PromptTune - AI Prompt Engineering Assistant & Generator',
    template: '%s | PromptTune',
  },
  description: 'Craft powerful Beginner, Intermediate, and Advanced AI prompts with PromptTune. Get explanations, examples, and AI-driven refinement to supercharge your interactions with any AI model.',
  keywords: [
    'AI prompt generator', 'prompt engineering tool', 'AI prompt assistant',
    'chatgpt prompts', 'gemini prompts', 'prompt refinement', 'beginner AI prompts',
    'advanced AI prompts', 'PromptTune', 'prompt creator', 'AI content generation',
  ],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    title: 'PromptTune',
    capable: true,
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'PromptTune - AI Prompt Engineering Assistant & Generator',
    description: 'Easily create and refine powerful AI prompts for any task.',
    type: 'website',
    url: 'https://prompttune.banter.life',
    images: [
      {
        url: 'https://prompttune.banter.life/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromptTune AI Prompt Assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PromptTune - AI Prompt Engineering Assistant & Generator',
    description: 'Craft powerful AI prompts with PromptTune.',
    images: ['https://prompttune.banter.life/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      {/* Next.js automatically injects <head> elements from metadata. No manual <link> or <meta> tags for these here. */}
      <body className={`${inter.className} min-h-screen h-full font-sans antialiased bg-neutral-100 text-slate-900 dark:bg-black dark:text-neutral-50 transition-colors duration-300`}>
        {children}
      </body>
    </html>
  );
}
