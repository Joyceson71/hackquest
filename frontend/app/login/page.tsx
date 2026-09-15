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
          <p className="text-sm font-mono font-bold uppercase tracking-widest text-primary mb-3 px-1 drop-shadow-[0_0_5px_rgba(0,255,65,0.5)]">> SELECT_AUTHORIZATION_LEVEL:</p>
          <div className="grid grid-cols-2 gap-4">
            {([
              { role: 'admin' as UserRole, label: 'SYS_ADMIN', desc: 'ROOT_ACCESS', Icon: ShieldCheck, accent: 'border-primary text-primary shadow-[0_0_10px_rgba(0,255,65,0.4)]' },
              { role: 'employee' as UserRole, label: 'USER_NODE', desc: 'GUEST_READ', Icon: User, accent: 'border-secondary text-secondary shadow-[0_0_10px_rgba(0,255,255,0.4)]' },
            ]).map(({ role, label, desc, Icon, accent }) => {
              const isSelected = selectedRole === role;
              return (
                <motion.button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-5 text-left border rounded-sm transition-all bg-black/80 backdrop-blur-sm ${
                    isSelected
                      ? `${accent}`
                      : 'border-primary/30 text-primary/60 hover:border-primary/80 hover:text-primary hover:shadow-[0_0_8px_rgba(0,255,65,0.2)]'
                  }`}
                >
                  <div className={`p-2.5 inline-flex mb-4 border rounded-sm ${isSelected ? accent : 'border-primary/30'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className={`text-sm font-mono font-bold uppercase tracking-widest`}>{label}</div>
                  <div className={`text-xs font-mono mt-1.5 opacity-80`}>{desc}</div>
                  {isSelected && (
                    <div className={`mt-3 text-xs font-mono font-bold uppercase flex items-center gap-1.5 w-fit px-2 py-0.5 border ${accent} bg-transparent`}>
                      [ACKNOWLEDGED]
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Auth Form */}
        <Card className="glass-card overflow-hidden border border-primary shadow-[0_0_15px_rgba(0,255,65,0.2)] rounded-sm bg-black/90">
          <CardHeader className="space-y-1.5 border-b border-primary/40 pb-6 bg-primary/5">
            <CardTitle className="text-2xl font-heading font-bold text-primary uppercase tracking-widest drop-shadow-[0_0_8px_rgba(0,255,65,0.6)]">
              {mode === 'LOGIN' ? `> AUTHENTICATE_AS [${selectedRole}]` : mode === 'SIGNUP' ? '> ALLOCATE_NEW_USER' : '> AWAITING_VERIFICATION'}
            </CardTitle>
            <CardDescription className="text-sm font-mono text-primary/70 uppercase tracking-widest">
              {mode === 'LOGIN'
                ? 'PROVIDE_CREDENTIALS_TO_PROCEED'
                : mode === 'SIGNUP'
                ? 'INITIALIZE_USER_DATA_BLOCK'
                : 'INPUT_SECURITY_TOKEN'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 bg-transparent">
            <form onSubmit={handleAuth} className="space-y-6">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive shadow-[0_0_10px_rgba(255,0,0,0.3)] text-xs font-mono font-bold uppercase tracking-widest rounded-sm"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>> ERR: {error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'SIGNUP' && (
                <div className="space-y-2.5">
                  <Label htmlFor="name" className="text-xs font-mono font-bold text-primary/80 uppercase tracking-widest">> IDENTIFIER_STRING</Label>
                  <Input id="name" type="text" placeholder="John_Doe" value={name} onChange={(e) => setName(e.target.value)} className="border border-primary/50 bg-black/50 text-primary focus-visible:ring-primary h-12 rounded-sm shadow-[inset_0_0_5px_rgba(0,255,65,0.1)] text-sm font-mono placeholder:text-primary/30" />
                </div>
              )}

              {mode !== 'CONFIRM' && (
                <>
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-xs font-mono font-bold text-primary/80 uppercase tracking-widest">> NET_ADDRESS</Label>
                    <Input id="email" type="email" required placeholder="user@node.net" value={email} onChange={(e) => setEmail(e.target.value)} className="border border-primary/50 bg-black/50 text-primary focus-visible:ring-primary h-12 rounded-sm shadow-[inset_0_0_5px_rgba(0,255,65,0.1)] text-sm font-mono placeholder:text-primary/30" />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="password" className="text-xs font-mono font-bold text-primary/80 uppercase tracking-widest">> ENCRYPTION_KEY</Label>
                    <Input id="password" type="password" required placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} className="border border-primary/50 bg-black/50 text-primary focus-visible:ring-primary h-12 rounded-sm shadow-[inset_0_0_5px_rgba(0,255,65,0.1)] text-sm font-mono placeholder:text-primary/30" />
                  </div>
                </>
              )}

              {mode === 'CONFIRM' && (
                <div className="space-y-2.5">
                  <Label htmlFor="code" className="text-xs font-mono font-bold text-primary/80 uppercase tracking-widest">> SECURITY_TOKEN</Label>
                  <Input id="code" required placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} className="border border-secondary bg-secondary/10 text-secondary focus-visible:ring-secondary h-16 text-center text-3xl tracking-[0.5em] font-mono shadow-[0_0_15px_rgba(0,255,255,0.2)] rounded-sm placeholder:text-secondary/20" />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary/10 hover:bg-primary/30 text-primary font-mono font-bold uppercase tracking-widest text-base py-7 border border-primary shadow-[0_0_10px_rgba(0,255,65,0.4)] hover:shadow-[0_0_20px_rgba(0,255,65,0.7)] transition-all rounded-sm mt-4"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {loading ? 'EXECUTING...' : mode === 'LOGIN' ? `> EXECUTE_LOGIN` : mode === 'SIGNUP' ? '> INITIALIZE' : '> TRANSMIT_TOKEN'}
              </Button>
            </form>

            <div className="mt-8 text-center text-xs font-mono font-bold uppercase tracking-widest">
              {mode === 'LOGIN' && (
                <span className="text-primary/60">
                  > UNREGISTERED_NODE?{' '}
                  <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-secondary hover:text-secondary/80 hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.8)] transition-all underline decoration-1 underline-offset-4">
                    ALLOCATE
                  </button>
                </span>
              )}
              {mode === 'SIGNUP' && (
                <span className="text-primary/60">
                  > ALREADY_REGISTERED?{' '}
                  <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="text-secondary hover:text-secondary/80 hover:drop-shadow-[0_0_5px_rgba(0,255,255,0.8)] transition-all underline decoration-1 underline-offset-4">
                    AUTHENTICATE
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
