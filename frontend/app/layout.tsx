import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sculra - Your AI QA Engineer',
  description: 'Automated website, repo, and desktop app testing powered by AI agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#00D4FF', // Accent cyan color
          colorBackground: '#09090b', // Neutral dark background
          colorInputBackground: '#18181b', // Input background
          colorText: '#f4f4f5', // High-contrast text
          colorTextSecondary: '#a1a1aa', // Secondary text
          colorBorder: 'rgba(255, 255, 255, 0.08)', // Thin slate borders
        },
        elements: {
          card: 'border border-white/8 bg-zinc-950/45 shadow-glass backdrop-blur-md',
          headerTitle: 'font-semibold text-foreground',
          headerSubtitle: 'text-xs text-muted-foreground',
          socialButtonsBlockButton: 'border border-white/8 hover:bg-muted text-foreground bg-zinc-900',
          socialButtonsBlockButtonText: 'font-medium',
          socialButtonsProviderIcon__apple: 'dark:invert',
          socialButtonsProviderIcon__github: 'dark:invert',
          socialButtonsBlockButtonIcon__apple: 'dark:invert',
          socialButtonsBlockButtonIcon__github: 'dark:invert',
          formButtonPrimary: 'bg-accent hover:bg-accent/80 text-background font-semibold',
          footerActionText: 'text-muted-foreground',
          footerActionLink: 'text-accent hover:underline',
        }
      }}
    >
      <html lang="en" className="h-full antialiased dark">
        <body className="min-h-full flex flex-col bg-background text-foreground">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
