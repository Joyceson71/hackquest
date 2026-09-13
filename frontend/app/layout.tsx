import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import UserMenu from '@/components/UserMenu';
import InteractiveBackground from '@/components/InteractiveBackground';
import { RoleProvider } from '@/lib/role-context';

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
      <body className="antialiased font-sans min-h-screen flex flex-col bg-background text-foreground">
        <RoleProvider>
          <InteractiveBackground />
          <header className="sticky top-0 z-50 bg-card border-b-8 border-border shadow-brutal">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 gap-3 overflow-hidden">
              <Link href="/" className="flex items-center gap-2 group min-w-0 shrink-0">
                <div className="bg-primary p-1 border-2 border-border shadow-brutal-sm group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none transition-all shrink-0">
                  <svg className="h-6 w-6 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-lg sm:text-2xl font-heading font-black text-foreground tracking-tighter uppercase truncate">MeetingCompiler</span>
              </Link>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <span className="hidden sm:inline-block text-sm font-black text-foreground bg-accent px-2 py-1 border-2 border-border shadow-brutal-sm uppercase">v2.0 MAX</span>
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            <AuthProvider>{children}</AuthProvider>
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
