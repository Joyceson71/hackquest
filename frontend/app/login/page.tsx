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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Select your role</p>
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
                  className={`p-5 text-left border rounded-xl transition-all ${
                    isSelected
                      ? `border-primary bg-primary/10 shadow-lg shadow-primary/5`
                      : 'border-white/10 bg-card/50 hover:bg-card hover:border-white/20'
                  }`}
                >
                  <div className={`${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} p-2.5 rounded-lg inline-flex mb-4 transition-colors`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1.5">{desc}</div>
                  {isSelected && (
                    <div className="mt-3 text-xs font-semibold text-primary flex items-center gap-1.5 bg-primary/10 w-fit px-2 py-0.5 rounded-full">
                      ✓ Selected
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Auth Form */}
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="space-y-1.5 border-b border-white/5 pb-6 bg-card/[0.02]">
            <CardTitle className="text-2xl font-heading font-bold">
              {mode === 'LOGIN' ? `Sign in as ${selectedRole}` : mode === 'SIGNUP' ? 'Create account' : 'Verify email'}
            </CardTitle>
            <CardDescription className="text-sm">
              {mode === 'LOGIN'
                ? 'Enter your credentials to continue'
                : mode === 'SIGNUP'
                ? 'Fill in your details to get started'
                : 'Check your email for the verification code'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleAuth} className="space-y-4">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium rounded-lg"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'SIGNUP' && (
                <div className="space-y-2.5">
                  <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                  <Input id="name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-foreground/20 focus-visible:ring-primary h-11" />
                </div>
              )}

              {mode !== 'CONFIRM' && (
                <>
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</Label>
                    <Input id="email" type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border-white/10 bg-foreground/20 focus-visible:ring-primary h-11" />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
                    <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="border-white/10 bg-foreground/20 focus-visible:ring-primary h-11" />
                  </div>
                </>
              )}

              {mode === 'CONFIRM' && (
                <div className="space-y-2.5">
                  <Label htmlFor="code" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verification Code</Label>
                  <Input id="code" required placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="border-primary/50 bg-primary/5 focus-visible:ring-primary h-14 text-center text-2xl tracking-[0.5em] font-mono rounded-xl" />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base py-6 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] mt-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {loading ? 'Processing...' : mode === 'LOGIN' ? `Sign in as ${selectedRole}` : mode === 'SIGNUP' ? 'Create Account' : 'Verify & Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              {mode === 'LOGIN' && (
                <span className="text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-primary hover:text-primary/80 font-medium transition-colors">
                    Sign up
                  </button>
                </span>
              )}
              {mode === 'SIGNUP' && (
                <span className="text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="text-primary hover:text-primary/80 font-medium transition-colors">
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
