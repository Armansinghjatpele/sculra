import type { Metadata } from 'next';
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
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

