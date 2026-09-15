import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import NavigationSidebar from '@/components/NavigationSidebar';
import TopNav from '@/components/TopNav';
import { RoleProvider } from '@/lib/role-context';

export const metadata: Metadata = {
  title: 'HackQuest — Premium Collaboration',
  description: 'Enterprise task management and meeting extraction.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans min-h-screen bg-background text-foreground overflow-x-hidden flex flex-col">
        <RoleProvider>
          <TopNav />
          <div className="flex flex-1 w-full max-w-[1920px] mx-auto relative p-0 md:p-6 lg:p-8 gap-0 md:gap-6 lg:gap-8">
            <NavigationSidebar />
            <main className="flex-1 w-full min-w-0 flex flex-col bg-card border-l md:border border-border relative z-10 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
              <AuthProvider>
                {children}
              </AuthProvider>
            </main>
          </div>
        </RoleProvider>
      </body>
    </html>
  );
}
