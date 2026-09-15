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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md space-y-6"
      >
        {/* Role Selector Bento Tiles */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-3 px-2">Select Account Type</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { role: 'admin' as UserRole, label: 'Admin', desc: 'Workspace', Icon: ShieldCheck },
              { role: 'employee' as UserRole, label: 'Employee', desc: 'Tasks', Icon: User },
            ]).map(({ role, label, desc, Icon }) => {
              const isSelected = selectedRole === role;
              return (
                <motion.button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 text-left border rounded-3xl transition-all flex flex-col items-start ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50 shadow-sm'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl mb-3 ${isSelected ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-base font-bold">{label}</div>
                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-primary-foreground/80' : 'text-gray-400'}`}>{desc}</div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Auth Form Bento Tile */}
        <Card className="glass-card overflow-hidden border-none shadow-xl shadow-gray-200/50 rounded-[2rem] bg-white">
          <CardHeader className="space-y-2 border-b border-gray-100 pb-6 pt-8 px-8 bg-white">
            <CardTitle className="text-2xl font-extrabold text-gray-900">
              {mode === 'LOGIN' ? `Sign in` : mode === 'SIGNUP' ? 'Create Account' : 'Verify Email'}
            </CardTitle>
            <CardDescription className="text-sm font-medium text-gray-500">
              {mode === 'LOGIN'
                ? 'Welcome back to MeetingCompiler'
                : mode === 'SIGNUP'
                ? 'Get started in seconds'
                : 'Enter the code sent to your email'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 px-8 pb-8">
            <form onSubmit={handleAuth} className="space-y-5">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 p-3 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100"
                  >
                    <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'SIGNUP' && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-gray-700">Full Name</Label>
                  <Input id="name" type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} className="border-gray-200 bg-gray-50 h-12 rounded-2xl text-base px-4 focus-visible:ring-primary focus-visible:bg-white transition-colors" />
                </div>
              )}

              {mode !== 'CONFIRM' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email</Label>
                    <Input id="email" type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border-gray-200 bg-gray-50 h-12 rounded-2xl text-base px-4 focus-visible:ring-primary focus-visible:bg-white transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
                    <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="border-gray-200 bg-gray-50 h-12 rounded-2xl text-base px-4 focus-visible:ring-primary focus-visible:bg-white transition-colors" />
                  </div>
                </>
              )}

              {mode === 'CONFIRM' && (
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-semibold text-gray-700">6-Digit Code</Label>
                  <Input id="code" required placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} className="border-gray-200 bg-gray-50 h-16 text-center text-3xl tracking-[0.5em] font-medium rounded-2xl focus-visible:ring-primary focus-visible:bg-white transition-colors" />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold text-base py-6 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all mt-4 hover:-translate-y-0.5"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {loading ? 'Processing...' : mode === 'LOGIN' ? `Continue as ${selectedRole}` : mode === 'SIGNUP' ? 'Create Account' : 'Verify'}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm font-medium">
              {mode === 'LOGIN' && (
                <span className="text-gray-500">
                  New here?{' '}
                  <button type="button" onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-primary hover:text-primary/80 transition-colors font-semibold">
                    Create an account
                  </button>
                </span>
              )}
              {mode === 'SIGNUP' && (
                <span className="text-gray-500">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('LOGIN'); setError(''); }} className="text-primary hover:text-primary/80 transition-colors font-semibold">
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
