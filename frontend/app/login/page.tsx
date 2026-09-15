'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, confirmSignUp } from 'aws-amplify/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRole, UserRole, isAdminEmail } from '@/lib/role-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react';

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
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Role Selector */}
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-black mb-3 px-1">Select your role</p>
          <div className="grid grid-cols-2 gap-4">
            {([
              { role: 'admin' as UserRole, label: 'ADMIN', desc: 'Manage meetings', Icon: ShieldCheck, accent: 'bg-primary' },
              { role: 'employee' as UserRole, label: 'EMPLOYEE', desc: 'View tasks', Icon: User, accent: 'bg-secondary' },
            ]).map(({ role, label, desc, Icon, accent }) => {
              const isSelected = selectedRole === role;
              return (
                <motion.button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98, x: 4, y: 4 }}
                  className={`p-5 text-left border-4 border-black transition-all ${
                    isSelected
                      ? `${accent} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
                      : 'bg-white hover:bg-muted shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  <div className={`p-2.5 inline-flex mb-4 border-2 border-black ${isSelected ? 'bg-white text-black' : 'bg-black text-white'}`}>
                    <Icon className="h-6 w-6 stroke-[3px]" />
                  </div>
                  <div className={`text-base font-black uppercase tracking-widest ${isSelected ? 'text-black' : 'text-black'}`}>{label}</div>
                  <div className={`text-xs font-bold mt-1.5 ${isSelected ? 'text-black' : 'text-muted-foreground'}`}>{desc}</div>
                  {isSelected && (
                    <div className="mt-3 text-xs font-black uppercase text-black flex items-center gap-1.5 bg-white border-2 border-black w-fit px-2 py-0.5">
                      ✓ Selected
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Auth Form */}
        <Card className="glass-card overflow-hidden rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="space-y-1.5 border-b-4 border-black pb-6 bg-accent">
            <CardTitle className="text-2xl font-heading font-black text-black uppercase tracking-tighter">
              {mode === 'LOGIN' ? `Sign in as ${selectedRole}` : mode === 'SIGNUP' ? 'Create account' : 'Verify email'}
            </CardTitle>
            <CardDescription className="text-sm font-bold text-black uppercase tracking-widest">
              {mode === 'LOGIN'
                ? 'Enter your credentials to continue'
                : mode === 'SIGNUP'
                ? 'Fill in your details to get started'
                : 'Check your email for the code'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 bg-white">
            <form onSubmit={handleAuth} className="space-y-6">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 p-3 bg-destructive text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-sm font-black uppercase tracking-widest"
                  >
                    <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 stroke-[3px]" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'SIGNUP' && (
                <div className="space-y-2.5">
                  <Label htmlFor="name" className="text-sm font-black text-black uppercase tracking-widest">Full Name</Label>
                  <Input id="name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="border-2 border-black bg-white focus-visible:ring-black h-12 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-lg font-bold" />
                </div>
              )}

              {mode !== 'CONFIRM' && (
                <>
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-sm font-black text-black uppercase tracking-widest">Email Address</Label>
                    <Input id="email" type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border-2 border-black bg-white focus-visible:ring-black h-12 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-lg font-bold" />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="password" className="text-sm font-black text-black uppercase tracking-widest">Password</Label>
                    <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="border-2 border-black bg-white focus-visible:ring-black h-12 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-lg font-bold" />
                  </div>
                </>
              )}

              {mode === 'CONFIRM' && (
                <div className="space-y-2.5">
                  <Label htmlFor="code" className="text-sm font-black text-black uppercase tracking-widest">Verification Code</Label>
                  <Input id="code" required placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="border-4 border-black bg-secondary focus-visible:ring-black h-16 text-center text-3xl tracking-[0.5em] font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none" />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary text-black font-black uppercase tracking-widest text-lg py-7 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:scale-[1.01] rounded-none mt-4"
              >
                {loading ? <Loader2 className="h-6 w-6 animate-spin mr-2 stroke-[3px]" /> : null}
                {loading ? 'Processing...' : mode === 'LOGIN' ? `Sign in as ${selectedRole}` : mode === 'SIGNUP' ? 'Create Account' : 'Verify & Sign In'}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm font-bold uppercase tracking-widest">
              {mode === 'LOGIN' && (
                <span className="text-black">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-primary hover:text-primary underline decoration-2 underline-offset-4">
                    Sign up
                  </button>
                </span>
              )}
              {mode === 'SIGNUP' && (
                <span className="text-black">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="text-primary hover:text-primary underline decoration-2 underline-offset-4">
                    Sign in
                  </button>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
