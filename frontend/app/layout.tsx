import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import NavigationSidebar from '@/components/NavigationSidebar';
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
      <body className="antialiased font-sans min-h-screen bg-background text-foreground overflow-x-hidden flex">
        <RoleProvider>
          <NavigationSidebar />
          
          <main className="flex-1 w-full min-w-0 min-h-screen relative flex flex-col">
            <AuthProvider>
              {children}
            </AuthProvider>
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
