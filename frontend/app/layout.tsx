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
          {/* Hardware Control Bar */}
          <div className="fixed top-0 left-0 w-full z-50 p-4">
            <header className="obj-raised max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-4 group shrink-0">
                <div className="flex items-center justify-center p-2 rounded-lg bg-background shadow-3d-inset border border-black/50 text-primary group-hover:text-accent transition-colors">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xl font-heading font-black tracking-widest text-foreground uppercase group-hover:text-primary transition-colors">
                  MeetingCompiler
                </span>
              </Link>
              <div className="flex items-center gap-6 shrink-0">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 obj-inset">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)] animate-pulse" />
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase">SYS_ONLINE</span>
                </div>
                <div className="obj-raised p-1 rounded-full">
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
