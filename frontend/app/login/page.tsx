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
          <p className="text-sm font-black uppercase text-foreground mb-3 px-1">SELECT YOUR ROLE</p>
          <div className="grid grid-cols-2 gap-4">
            {([
              { role: 'admin' as UserRole, label: 'ADMIN', desc: 'Manage meetings & assign tasks', Icon: ShieldCheck, accent: 'bg-primary' },
              { role: 'employee' as UserRole, label: 'EMPLOYEE', desc: 'View your assigned tasks', Icon: User, accent: 'bg-secondary' },
            ]).map(({ role, label, desc, Icon, accent }) => {
              const isSelected = selectedRole === role;
              return (
                <motion.button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98, x: 4, y: 4 }}
                  className={`p-4 text-left border-4 transition-all ${
                    isSelected
                      ? `border-border shadow-brutal bg-card`
                      : 'border-border/40 bg-card/50 hover:border-border hover:shadow-brutal-sm'
                  }`}
                >
                  <div className={`${accent} p-2 inline-flex mb-3 border-2 border-border`}>
                    <Icon className="h-5 w-5 text-background stroke-[3]" />
                  </div>
                  <div className="text-sm font-black uppercase text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-bold">{desc}</div>
                  {isSelected && (
                    <div className="mt-2 text-xs font-black uppercase text-primary flex items-center gap-1">
                      ✓ SELECTED
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Auth Form */}
        <Card className="border-4 border-border shadow-brutal bg-card">
          <CardHeader>
            <CardTitle className="text-2xl font-black uppercase">
              {mode === 'LOGIN' ? `SIGN IN AS ${selectedRole?.toUpperCase()}` : mode === 'SIGNUP' ? 'CREATE ACCOUNT' : 'VERIFY EMAIL'}
            </CardTitle>
            <CardDescription className="font-bold uppercase text-xs">
              {mode === 'LOGIN'
                ? 'Enter your credentials to continue'
                : mode === 'SIGNUP'
                ? 'Fill in your details to get started'
                : 'Check your email for the verification code'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border-2 border-destructive/40 text-sm font-bold"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 stroke-[3]" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'SIGNUP' && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-black uppercase text-xs">Full Name</Label>
                  <Input id="name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="border-2 border-border bg-input font-bold" />
                </div>
              )}

              {mode !== 'CONFIRM' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-black uppercase text-xs">Email Address</Label>
                    <Input id="email" type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border-2 border-border bg-input font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="font-black uppercase text-xs">Password</Label>
                    <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="border-2 border-border bg-input font-bold" />
                  </div>
                </>
              )}

              {mode === 'CONFIRM' && (
                <div className="space-y-2">
                  <Label htmlFor="code" className="font-black uppercase text-xs">Verification Code</Label>
                  <Input id="code" required placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="border-2 border-border bg-input font-bold text-center text-xl tracking-widest font-mono" />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary text-background font-black uppercase text-base py-6 shadow-brutal border-4 border-border transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'PROCESSING...' : mode === 'LOGIN' ? `SIGN IN AS ${selectedRole?.toUpperCase()}` : mode === 'SIGNUP' ? 'CREATE ACCOUNT' : 'VERIFY & SIGN IN'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {mode === 'LOGIN' && (
                <span className="font-bold text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-primary hover:underline font-black uppercase">
                    SIGN UP
                  </button>
                </span>
              )}
              {mode === 'SIGNUP' && (
                <span className="font-bold text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="text-primary hover:underline font-black uppercase">
                    SIGN IN
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
