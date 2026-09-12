'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, confirmSignUp } from 'aws-amplify/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP' | 'CONFIRM'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        const { isSignedIn, nextStep } = await signIn({ username: email, password });
        if (isSignedIn) {
          router.push('/meetings/new');
        } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          setMode('CONFIRM');
        }
      } else if (mode === 'SIGNUP') {
        const { nextStep } = await signUp({
          username: email,
          password,
          options: { userAttributes: { email } },
        });
        if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
          setMode('CONFIRM');
        }
      } else if (mode === 'CONFIRM') {
        const { isSignUpComplete } = await confirmSignUp({ username: email, confirmationCode: code });
        if (isSignUpComplete) {
          await signIn({ username: email, password });
          router.push('/meetings/new');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {mode === 'LOGIN' ? 'Sign In' : mode === 'SIGNUP' ? 'Create Account' : 'Verify Email'}
          </CardTitle>
          <CardDescription>
            {mode === 'LOGIN' ? 'Welcome back to MeetingCompiler' : mode === 'SIGNUP' ? 'Sign up to start compiling meetings' : 'Check your email for the verification code'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mode === 'CONFIRM'}
              />
            </div>

            {mode !== 'CONFIRM' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            {mode === 'CONFIRM' && (
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : mode === 'LOGIN' ? 'Sign In' : mode === 'SIGNUP' ? 'Sign Up' : 'Verify & Sign In'}
            </Button>
          </form>

          {mode === 'LOGIN' && (
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Don&apos;t have an account? </span>
              <button onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-primary hover:underline font-medium">
                Sign Up
              </button>
            </div>
          )}

          {mode === 'SIGNUP' && (
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <button onClick={() => { setMode('LOGIN'); setError(''); }} className="text-primary hover:underline font-medium">
                Sign In
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
