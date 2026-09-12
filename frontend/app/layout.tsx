import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import UserMenu from '@/components/UserMenu';

export const metadata: Metadata = {
  title: 'MeetingCompiler — Meeting-to-Action Compiler',
  description: 'Upload meeting transcripts, extract action items with AI, and confirm commitments with full audit trails.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b-4 border-border shadow-clay">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
            <a href="/meetings/new" className="flex items-center gap-2 group">
              <svg className="h-6 w-6 text-primary transition-colors group-hover:text-primary/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-lg font-bold text-foreground tracking-tight">MeetingCompiler</span>
            </a>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">v2.0 MVP</span>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <AuthProvider>{children}</AuthProvider>
        </main>
      </body>
    </html>
  );
}
