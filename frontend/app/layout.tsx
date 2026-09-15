import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import NavigationSidebar from '@/components/NavigationSidebar';
import TopNav from '@/components/TopNav';
import InteractiveBackground from '@/components/InteractiveBackground';
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
      <body className="antialiased font-sans min-h-screen bg-background text-foreground overflow-x-hidden">
        <InteractiveBackground />
        
        <RoleProvider>
          <div className="flex flex-col min-h-screen relative z-10">
            <TopNav />
            
            <div className="flex flex-1 w-full pt-4 pb-4">
              <NavigationSidebar />
              
              <main className="flex-1 w-full min-w-0 flex flex-col px-4 md:px-6 relative spatial-wrapper">
                <AuthProvider>
                  {children}
                </AuthProvider>
              </main>
            </div>
          </div>
        </RoleProvider>
      </body>
    </html>
  );
}
