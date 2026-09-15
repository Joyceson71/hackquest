import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import UserMenu from '@/components/UserMenu';
import { RoleProvider } from '@/lib/role-context';

export const metadata: Metadata = {
  title: 'MeetingCompiler — Terminal',
  description: 'Upload transcripts, extract items, confirm commitments.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
        <RoleProvider>
          {/* Bento Floating Navigation */}
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
            <header className="glass-card px-4 sm:px-6 py-3 flex items-center justify-between rounded-full bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm">
              <Link href="/" className="flex items-center gap-3 group shrink-0">
                <div className="flex items-center justify-center p-2 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-lg font-heading font-extrabold tracking-tight text-foreground">
                  MeetingCompiler
                </span>
              </Link>
              <div className="flex items-center gap-4 shrink-0">
                <span className="hidden sm:inline-flex items-center text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
                  v5.0 Bento
                </span>
                <div className="bg-white rounded-full">
                  <UserMenu />
                </div>
              </div>
            </header>
          </div>
          
          <main className="flex-1 w-full relative">
            <AuthProvider>
              {children}
            </AuthProvider>
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
