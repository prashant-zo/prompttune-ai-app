'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase-auth';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verificationStatus = searchParams.get('verified');
  const prefillEmail = searchParams.get('email');

  const [email, setEmail] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        if (!userCredential.user.emailVerified) {
          try {
            await sendEmailVerification(userCredential.user);
            setVerificationEmailSent(true);
            setTimeout(() => setVerificationEmailSent(false), 10000);
          } catch (err) {
            console.error('Error sending verification email:', err);
          }
        }
        router.push('/');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please sign up first.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again or use "Forgot Password".');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        setError(err.message || 'Login failed');
      }
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        if (!result.user.emailVerified && result.providerId === 'password') {
          try {
            await sendEmailVerification(result.user);
            setVerificationEmailSent(true);
            setTimeout(() => setVerificationEmailSent(false), 10000);
          } catch (err) {
            console.error('Error sending verification email:', err);
          }
        }
        router.push('/');
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by your browser. Please allow pop-ups for this site.');
      } else {
        setError(err.message || 'Google sign-in failed');
      }
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address first, then request a password reset.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError("Password reset email sent! Please check your inbox and spam folder.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || "Failed to send password reset email.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-background p-6 shadow-sm sm:p-8">
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue your PromptTune chats.</p>
      </div>
      
      {verificationStatus === 'false' && (
        <div className="mb-4 p-3 rounded-md bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-200 text-sm">
          Account created successfully! A verification link has been sent to your email. Please check your inbox (and spam folder) and click the link to verify your account.
        </div>
      )}
      
      {verificationStatus === 'error' && (
        <div className="mb-4 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-200 text-sm">
          Account created, but we encountered an issue sending the verification email. You can try logging in. If your email is still unverified, you might be prompted again or can request a new verification link later.
        </div>
      )}

      {verificationEmailSent && (
        <div className="mb-4 p-3 rounded-md bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm">
          A new verification email has been sent to your email address. Please check your inbox (and spam folder).
        </div>
      )}

      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none"><g clipPath="url(#clip0_17_40)"><path d="M47.532 24.552c0-1.636-.146-3.2-.418-4.704H24.48v9.02h12.98c-.56 3.02-2.24 5.58-4.78 7.3v6.06h7.74c4.54-4.18 7.11-10.34 7.11-17.676z" fill="#4285F4"/><path d="M24.48 48c6.48 0 11.92-2.14 15.89-5.82l-7.74-6.06c-2.14 1.44-4.88 2.3-8.15 2.3-6.26 0-11.56-4.22-13.46-9.9H3.5v6.22C7.46 43.34 15.36 48 24.48 48z" fill="#34A853"/><path d="M11.02 28.52c-.48-1.44-.76-2.98-.76-4.52s.28-3.08.76-4.52v-6.22H3.5A23.97 23.97 0 000 24c0 3.98.96 7.76 2.66 11.08l8.36-6.56z" fill="#FBBC05"/><path d="M24.48 9.54c3.54 0 6.68 1.22 9.16 3.62l6.86-6.86C36.4 2.14 30.96 0 24.48 0 15.36 0 7.46 4.66 3.5 11.26l8.36 6.22c1.9-5.68 7.2-9.9 13.46-9.9z" fill="#EA4335"/></g><defs><clipPath id="clip0_17_40"><rect width="48" height="48" fill="white"/></clipPath></defs></svg>
        Sign in with Google
      </button>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
          required
        />
        <div className="space-y-1">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
            required
          />
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Forgot Password?
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-foreground py-3 font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {error && (
        <div className={`text-sm text-center ${
          error.includes('sent') || error.includes('check your inbox')
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-500'
        }`}>
          {error}
        </div>
      )}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-foreground hover:underline">Sign up</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/35 p-4">
      <AuthProvider>
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading login options...</div>}>
          <LoginFormContent />
        </Suspense>
      </AuthProvider>
    </div>
  );
} 
