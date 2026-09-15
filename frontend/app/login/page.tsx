'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, confirmSignUp } from 'aws-amplify/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SpatialCard from '@/components/SpatialCard';
import { useRole, UserRole, isAdminEmail } from '@/lib/role-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  User,
  Loader2,
  AlertCircle,
  Lock,
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === 'LOGIN' ? 'Welcome back' : mode === 'SIGNUP' ? 'Create an account' : 'Verify your email'}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {mode === 'LOGIN' ? 'Enter your credentials to access your workspace' : mode === 'SIGNUP' ? 'Get started with HackQuest' : 'Enter the code sent to your inbox'}
          </p>
        </div>

        <div className="h-[500px]">
          <SpatialCard tiltIntensity={10} glowIntensity={0.2} className="shadow-2xl">
            <form onSubmit={handleAuth} className="space-y-5 h-full flex flex-col justify-center">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm font-medium border border-destructive/20 mb-4">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'SIGNUP' && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">Full Name</Label>
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="John Doe" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="bg-black/20 border-white/10 h-11 text-foreground focus-visible:ring-primary focus-visible:border-primary transition-all" 
                  />
                </div>
              )}

              {mode !== 'CONFIRM' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      required 
                      placeholder="you@example.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="bg-black/20 border-white/10 h-11 text-foreground focus-visible:ring-primary focus-visible:border-primary transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                    </div>
                    <Input 
                      id="password" 
                      type="password" 
                      required 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className="bg-black/20 border-white/10 h-11 text-foreground focus-visible:ring-primary focus-visible:border-primary transition-all" 
                    />
                  </div>
                </>
              )}

              {mode === 'CONFIRM' && (
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-medium text-foreground">Verification Code</Label>
                  <Input 
                    id="code" 
                    required 
                    placeholder="000000" 
                    value={code} 
                    onChange={(e) => setCode(e.target.value)} 
                    className="bg-black/20 border-white/10 h-14 text-center text-3xl tracking-widest font-mono text-foreground focus-visible:ring-primary focus-visible:border-primary transition-all" 
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-11 mt-6 shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] transition-all"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {loading ? 'Processing...' : mode === 'LOGIN' ? 'Sign In' : mode === 'SIGNUP' ? 'Create Account' : 'Verify'}
              </Button>
            </form>
          </SpatialCard>
        </div>

        {/* Role Selector (Compact) */}
        {mode !== 'CONFIRM' && (
          <div className="mt-8">
            <p className="text-xs font-medium text-muted-foreground mb-3 text-center uppercase tracking-wider">Account Type</p>
            <div className="flex gap-3 justify-center">
              {([
                { role: 'admin' as UserRole, label: 'Admin', Icon: ShieldCheck },
                { role: 'employee' as UserRole, label: 'User', Icon: User },
              ]).map(({ role, label, Icon }) => {
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all border ${
                      isSelected
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="mt-8 text-center text-sm font-medium">
          {mode === 'LOGIN' && (
            <span className="text-muted-foreground">
              Don't have an account?{' '}
              <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-foreground hover:text-primary transition-colors underline underline-offset-4">
                Sign up
              </button>
            </span>
          )}
          {mode === 'SIGNUP' && (
            <span className="text-muted-foreground">
              Already have an account?{' '}
              <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="text-foreground hover:text-primary transition-colors underline underline-offset-4">
                Sign in
              </button>
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
