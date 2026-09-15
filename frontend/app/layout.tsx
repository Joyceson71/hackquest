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
          {/* Cyberpunk HUD Navbar */}
          <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-primary shadow-[0_0_15px_rgba(0,255,65,0.3)]">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 gap-3">
              <Link href="/" className="flex items-center gap-3 group shrink-0">
                <div className="flex items-center justify-center p-1.5 text-primary border border-primary bg-primary/10 shadow-[0_0_8px_rgba(0,255,65,0.5)] group-hover:bg-primary group-hover:text-black group-hover:shadow-[0_0_15px_rgba(0,255,65,0.8)] transition-all">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xl sm:text-2xl font-heading font-bold tracking-widest text-primary drop-shadow-[0_0_8px_rgba(0,255,65,0.8)] uppercase">
                  SYS.Meeting_Compiler
                </span>
              </Link>
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <span className="hidden sm:inline-flex items-center text-xs font-mono uppercase tracking-widest text-secondary border border-secondary px-2 py-0.5 shadow-[0_0_5px_rgba(0,255,255,0.5)] bg-secondary/10">
                  v4.0_CYBER
                </span>
                <div className="border border-primary bg-black shadow-[0_0_8px_rgba(0,255,65,0.3)] hover:shadow-[0_0_12px_rgba(0,255,65,0.6)] transition-all">
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
