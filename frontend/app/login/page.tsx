'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, confirmSignUp } from 'aws-amplify/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRole, UserRole, isAdminEmail } from '@/lib/role-context';
import { Loader2, AlertCircle } from 'lucide-react';

type AuthMode = 'LOGIN' | 'SIGNUP' | 'CONFIRM';

export default function LoginPage() {
  const router = useRouter();
  const { setRole, setUserEmail, setUserName } = useRole();

  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (selectedRole === 'admin' && !isAdminEmail(email)) {
        throw new Error("You are not authorized to access or create an Admin account.");
      }

      if (mode === 'LOGIN') {
        const { isSignedIn, nextStep } = await signIn({ username: email, password });
        if (isSignedIn) {
          setRole(selectedRole);
          setUserEmail(email);
          setUserName(name || email);
          router.push(selectedRole === 'admin' ? '/' : '/employee');
        } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          setMode('CONFIRM');
        }
      } else if (mode === 'SIGNUP') {
        const { nextStep } = await signUp({
          username: email,
          password,
          options: { userAttributes: { email, ...(name ? { name } : {}) } },
        });
        if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') setMode('CONFIRM');
      } else if (mode === 'CONFIRM') {
        const { isSignUpComplete } = await confirmSignUp({ username: email, confirmationCode: code });
        if (isSignUpComplete) {
          await signIn({ username: email, password });
          setRole(selectedRole);
          setUserEmail(email);
          setUserName(name || email);
          router.push(selectedRole === 'admin' ? '/' : '/employee');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md manga-panel p-10 shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
        
        {/* Header */}
        <div className="mb-10 border-b-2 border-border pb-6 relative">
          <div className="absolute top-0 right-0 p-2 text-border opacity-20 manga-header text-6xl leading-none -mt-4 -mr-4">
            01
          </div>
          <p className="meta-label mb-2 tracking-widest text-primary font-bold">HQ // AUTHENTICATION</p>
          <h1 className="manga-header text-5xl text-foreground tracking-tight">
            {mode === 'LOGIN' ? 'ACCESS' : mode === 'SIGNUP' ? 'INITIALIZE' : 'VERIFY'}
          </h1>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm font-medium border border-destructive/20 mb-4">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'SIGNUP' && (
            <div className="space-y-2">
              <Label htmlFor="name" className="meta-label">FULL NAME</Label>
              <Input 
                id="name" 
                type="text" 
                placeholder="JOHN DOE" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full rounded-none border-t-0 border-x-0 border-b-2 border-border bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors" 
              />
            </div>
          )}

          {mode !== 'CONFIRM' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email" className="meta-label">EMAIL IDENTIFIER</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  placeholder="USER@DOMAIN.COM" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full rounded-none border-t-0 border-x-0 border-b-2 border-border bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors font-mono uppercase" 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="meta-label">CREDENTIAL</Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full rounded-none border-t-0 border-x-0 border-b-2 border-border bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary transition-colors font-mono tracking-widest" 
                />
              </div>
            </>
          )}

          {mode === 'CONFIRM' && (
            <div className="space-y-2">
              <Label htmlFor="code" className="meta-label">VERIFICATION SEQUENCE</Label>
              <Input 
                id="code" 
                required 
                placeholder="000000" 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                className="w-full rounded-none border-border bg-transparent text-center text-2xl tracking-[0.5em] font-mono h-16 focus-visible:ring-0 focus-visible:border-primary" 
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-8 btn-primary h-12 meta-label tracking-widest text-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? 'PROCESSING...' : mode === 'LOGIN' ? 'SIGN IN' : mode === 'SIGNUP' ? 'CREATE ACCOUNT' : 'VERIFY'}
          </Button>
        </form>

        {/* Role Selector */}
        {mode !== 'CONFIRM' && (
          <div className="mt-8 pt-8 border-t border-border">
            <p className="meta-label mb-4">ACCESS LEVEL</p>
            <div className="grid grid-cols-2 gap-0 border border-border">
              {([
                { role: 'admin' as UserRole, label: 'SYSTEM LEAD' },
                { role: 'employee' as UserRole, label: 'OPERATIVE' },
              ]).map(({ role, label }) => {
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className={`flex items-center justify-center px-4 py-3 meta-label font-bold tracking-widest transition-colors border-r last:border-r-0 border-border ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-transparent text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="mt-8 text-left">
          {mode === 'LOGIN' && (
            <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="meta-label text-primary hover:underline underline-offset-4 font-bold tracking-widest">
              &gt; INITIALIZE NEW SESSION
            </button>
          )}
          {mode === 'SIGNUP' && (
            <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="meta-label text-primary hover:underline underline-offset-4 font-bold tracking-widest">
              &gt; RETURN TO ACCESS
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
