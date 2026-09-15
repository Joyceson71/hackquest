import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import UserMenu from '@/components/UserMenu';
import { RoleProvider } from '@/lib/role-context';

export const metadata: Metadata = {
  title: 'MeetingCompiler — Action Compiler',
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
          {/* Brutalist Top Navbar */}
          <header className="sticky top-0 z-50 bg-card border-b-4 border-black">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-20 gap-3">
              <Link href="/" className="flex items-center gap-3 group shrink-0 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform active:translate-y-0.5 active:translate-x-0.5">
                <div className="flex items-center justify-center p-2 bg-primary border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow">
                  <svg className="h-6 w-6 stroke-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xl sm:text-3xl font-heading font-black tracking-tighter uppercase text-black">MeetingCompiler</span>
              </Link>
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <span className="hidden sm:inline-flex items-center text-xs font-bold uppercase tracking-widest text-black bg-accent px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  V3.0 (BRUTAL)
                </span>
                <div className="border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <UserMenu />
                </div>
              </div>
            </div>
          </header>
          
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
