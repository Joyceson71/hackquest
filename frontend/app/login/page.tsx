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
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md space-y-8"
      >
        {/* Hardware Status Header */}
        <div className="flex flex-col items-center justify-center gap-3 mb-4">
          <div className="p-3 obj-raised rounded-full text-primary shadow-[inset_0_0_10px_rgba(0,240,255,0.1)]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-heading font-black tracking-widest text-foreground uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
            Security Access
          </h1>
        </div>

        {/* Auth Form Terminal (Inset Screen) */}
        <Card className="obj-raised overflow-hidden border-none p-2 bg-background">
          <div className="obj-inset p-8 rounded-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            
            <CardHeader className="space-y-2 p-0 mb-6 text-center">
              <CardTitle className="text-xl font-black text-primary uppercase tracking-widest drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                {mode === 'LOGIN' ? `Authenticate: ${selectedRole}` : mode === 'SIGNUP' ? 'Initialize User' : 'Enter Token'}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <form onSubmit={handleAuth} className="space-y-6">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-3 p-4 obj-raised bg-background text-destructive text-[10px] font-black uppercase tracking-widest border-l-2 border-l-destructive shadow-[inset_0_0_10px_rgba(255,51,51,0.1)]"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 drop-shadow-[0_0_5px_var(--destructive)]" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {mode === 'SIGNUP' && (
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Full Name</Label>
                    <Input id="name" type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} className="obj-inset bg-transparent border-none text-primary focus-visible:ring-primary h-12 px-4 shadow-[inset_0_0_5px_rgba(0,240,255,0.1)] text-sm font-bold uppercase tracking-widest placeholder:text-muted-foreground/50" />
                  </div>
                )}

                {mode !== 'CONFIRM' && (
                  <>
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email Address</Label>
                      <Input id="email" type="email" required placeholder="user@node.net" value={email} onChange={(e) => setEmail(e.target.value)} className="obj-inset bg-transparent border-none text-primary focus-visible:ring-primary h-12 px-4 shadow-[inset_0_0_5px_rgba(0,240,255,0.1)] text-sm font-bold uppercase tracking-widest placeholder:text-muted-foreground/50" />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="password" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Security Key</Label>
                      <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="obj-inset bg-transparent border-none text-primary focus-visible:ring-primary h-12 px-4 shadow-[inset_0_0_5px_rgba(0,240,255,0.1)] text-sm font-bold tracking-widest placeholder:text-muted-foreground/50" />
                    </div>
                  </>
                )}

                {mode === 'CONFIRM' && (
                  <div className="space-y-3">
                    <Label htmlFor="code" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">6-Digit Code</Label>
                    <Input id="code" required placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} className="obj-inset bg-transparent border border-accent/20 text-accent focus-visible:ring-accent h-16 text-center text-3xl tracking-[0.5em] font-black shadow-[inset_0_0_15px_rgba(255,51,102,0.1)] placeholder:text-accent/20" />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="btn-3d-primary w-full py-7 mt-8 text-sm"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : null}
                  {loading ? 'PROCESSING...' : mode === 'LOGIN' ? `ACCESS [${selectedRole}]` : mode === 'SIGNUP' ? 'REGISTER' : 'VERIFY_TOKEN'}
                </Button>
              </form>
            </CardContent>
          </div>
        </Card>

        {/* Role Selector Hardware Switches */}
        <div className="pt-2">
          <p className="text-[10px] font-black text-muted-foreground mb-4 uppercase tracking-widest text-center">Toggle Authorization Level</p>
          <div className="flex gap-4 justify-center">
            {([
              { role: 'admin' as UserRole, label: 'ADMIN', Icon: ShieldCheck },
              { role: 'employee' as UserRole, label: 'USER', Icon: User },
            ]).map(({ role, label, Icon }) => {
              const isSelected = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  className={`relative flex items-center justify-center gap-3 px-6 py-4 rounded-xl transition-all ${
                    isSelected
                      ? 'btn-3d text-primary shadow-3d-pressed drop-shadow-[0_0_5px_var(--primary)]'
                      : 'obj-raised text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-black text-[10px] uppercase tracking-widest">{label}</span>
                  {isSelected && (
                     <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mt-8 text-center text-[10px] font-black uppercase tracking-widest">
          {mode === 'LOGIN' && (
            <span className="text-muted-foreground">
              UNREGISTERED?{' '}
              <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-accent hover:text-white drop-shadow-[0_0_5px_var(--accent)] ml-2 transition-all">
                ALLOCATE NEW
              </button>
            </span>
          )}
          {mode === 'SIGNUP' && (
            <span className="text-muted-foreground">
              REGISTERED?{' '}
              <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="text-accent hover:text-white drop-shadow-[0_0_5px_var(--accent)] ml-2 transition-all">
                AUTHENTICATE
              </button>
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
