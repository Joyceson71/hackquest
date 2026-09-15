import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
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
      <body className="antialiased font-sans min-h-screen flex bg-background text-foreground overflow-hidden">
        <RoleProvider>
          <AuthProvider>
            <Sidebar />
            <main className="flex-1 h-screen overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto w-full">
                {children}
              </div>
            </main>
          </AuthProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
