'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, confirmSignUp } from 'aws-amplify/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRole, UserRole } from '@/lib/role-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  User,
  LogIn,
  UserPlus,
  MailCheck,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

type AuthMode = 'LOGIN' | 'SIGNUP' | 'CONFIRM';

const roleConfig = {
  admin: {
    label: 'Admin',
    description: 'Upload transcripts, assign tasks & manage the team',
    icon: ShieldCheck,
    gradient: 'from-violet-600 to-indigo-600',
    glow: 'shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]',
    border: 'border-violet-500/60',
    bg: 'bg-violet-500/10',
    textColor: 'text-violet-400',
  },
  employee: {
    label: 'Employee',
    description: 'View your assigned tasks and update their status',
    icon: User,
    gradient: 'from-blue-600 to-cyan-600',
    glow: 'shadow-[0_0_30px_-5px_rgba(59,130,246,0.6)]',
    border: 'border-blue-500/60',
    bg: 'bg-blue-500/10',
    textColor: 'text-blue-400',
  },
} as const;

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

  const config = selectedRole ? roleConfig[selectedRole] : roleConfig.admin;

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        const { isSignedIn, nextStep } = await signIn({ username: email, password });
        if (isSignedIn) {
          // Persist role and user info
          setRole(selectedRole);
          setUserEmail(email);
          setUserName(name || email);

          if (selectedRole === 'admin') {
            router.push('/');
          } else {
            router.push('/employee');
          }
        } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          setMode('CONFIRM');
        }
      } else if (mode === 'SIGNUP') {
        const { nextStep } = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              ...(name ? { name } : {}),
            },
          },
        });
        if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
          setMode('CONFIRM');
        }
      } else if (mode === 'CONFIRM') {
        const { isSignUpComplete } = await confirmSignUp({
          username: email,
          confirmationCode: code,
        });
        if (isSignUpComplete) {
          await signIn({ username: email, password });
          setRole(selectedRole);
          setUserEmail(email);
          setUserName(name || email);

          if (selectedRole === 'admin') {
            router.push('/');
          } else {
            router.push('/employee');
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">
            Welcome to{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              MeetingCompiler
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to your workspace
          </p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {(Object.entries(roleConfig) as [UserRole, typeof roleConfig.admin][]).map(
            ([roleKey, cfg]) => {
              const Icon = cfg.icon;
              const isSelected = selectedRole === roleKey;
              return (
                <motion.button
                  key={roleKey}
                  type="button"
                  onClick={() => handleRoleSelect(roleKey)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                    isSelected
                      ? `${cfg.border} ${cfg.bg} ${cfg.glow}`
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div
                    className={`inline-flex p-2.5 rounded-xl mb-3 bg-gradient-to-br ${cfg.gradient}`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className={`text-sm font-bold mb-1 ${isSelected ? cfg.textColor : 'text-foreground'}`}>
                    {cfg.label}
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">
                    {cfg.description}
                  </div>
                  {isSelected && (
                    <motion.div
                      layoutId="role-selected-indicator"
                      className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-gradient-to-br ${cfg.gradient}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    />
                  )}
                </motion.button>
              );
            }
          )}
        </div>

        {/* Auth Form Card */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-card p-8 border border-white/10"
        >
          {/* Mode Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${config.gradient}`}>
              {mode === 'LOGIN' && <LogIn className="h-4 w-4 text-white" />}
              {mode === 'SIGNUP' && <UserPlus className="h-4 w-4 text-white" />}
              {mode === 'CONFIRM' && <MailCheck className="h-4 w-4 text-white" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {mode === 'LOGIN'
                  ? `Sign in as ${config.label}`
                  : mode === 'SIGNUP'
                  ? `Create ${config.label} Account`
                  : 'Verify Your Email'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === 'LOGIN'
                  ? 'Enter your credentials to continue'
                  : mode === 'SIGNUP'
                  ? 'Fill in your details to get started'
                  : 'Check your email for the verification code'}
              </p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Error display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Name field (signup only) */}
            {mode === 'SIGNUP' && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Email field */}
            {mode !== 'CONFIRM' && (
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Password field */}
            {mode !== 'CONFIRM' && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Verification code field */}
            {mode === 'CONFIRM' && (
              <div className="space-y-1.5">
                <Label htmlFor="email-display" className="text-sm font-medium text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email-display"
                  value={email}
                  disabled
                  className="bg-white/5 border-white/10 rounded-xl opacity-60"
                />
                <Label htmlFor="code" className="text-sm font-medium text-muted-foreground">
                  Verification Code
                </Label>
                <Input
                  id="code"
                  required
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 text-center text-xl tracking-[0.5em] font-mono"
                />
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading}
              className={`w-full bg-gradient-to-r ${config.gradient} text-white font-semibold py-5 rounded-xl hover:opacity-90 transition-all ${config.glow} border-0 mt-2`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              {loading
                ? 'Processing...'
                : mode === 'LOGIN'
                ? `Sign In as ${config.label}`
                : mode === 'SIGNUP'
                ? 'Create Account'
                : 'Verify & Sign In'}
            </Button>
          </form>

          {/* Mode switcher */}
          <div className="mt-5 text-center text-sm">
            {mode === 'LOGIN' && (
              <span className="text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('SIGNUP'); setError(''); }}
                  className={`${config.textColor} hover:underline font-semibold`}
                >
                  Sign Up
                </button>
              </span>
            )}
            {mode === 'SIGNUP' && (
              <span className="text-muted-foreground">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('LOGIN'); setError(''); }}
                  className={`${config.textColor} hover:underline font-semibold`}
                >
                  Sign In
                </button>
              </span>
            )}
          </div>
        </motion.div>

        {/* Role hint */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Signing in as{' '}
          <span className={`font-bold ${config.textColor}`}>{config.label}</span>
          {' '}— wrong role?{' '}
          <button
            type="button"
            onClick={() => handleRoleSelect(selectedRole === 'admin' ? 'employee' : 'admin')}
            className="underline hover:text-foreground"
          >
            Switch
          </button>
        </p>
      </motion.div>
    </div>
  );
}
