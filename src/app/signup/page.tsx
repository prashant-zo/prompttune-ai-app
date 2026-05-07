'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase-auth';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';

function SignUpContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleError = (error: any, context: string) => {
    setError(error.message || `An error occurred during ${context}`);
    if (process.env.NODE_ENV === 'development') {
      console.error(`${context} error:`, error);
    }
  };

  const handleEmailPasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);

    // Validate password
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsCreatingAccount(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      if (!newUser) {
        throw new Error("User creation succeeded but no user object returned.");
      }

      setIsSendingVerification(true);
      try {
        await sendEmailVerification(newUser);
        // Redirect to login page with success message and email for pre-filling
        router.push(`/login?verified=false&email=${encodeURIComponent(newUser.email || '')}`);
      } catch (verificationError: any) {
        handleError(verificationError, 'sending verification email');
        // User is created but verification email failed
        router.push(`/login?verified=error&email=${encodeURIComponent(newUser.email || '')}`);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use. Please login or use a different email.');
      } else if (err.code === 'auth/weak-password') {
        setError('The password is too weak. Please use a stronger password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        handleError(err, 'sign up');
      }
    } finally {
      setIsCreatingAccount(false);
      setIsSendingVerification(false);
    }
  };

  const isLoading = isCreatingAccount || isSendingVerification;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/35 p-4">
      <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Create account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Start saving and refining your prompt history.</p>
        </div>
        <form onSubmit={handleEmailPasswordSignUp} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              required
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setPasswordError(validatePassword(e.target.value));
              }}
              placeholder="Password"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              required
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-500">{passwordError}</p>
            )}
          </div>
          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !!passwordError}
            className="w-full rounded-xl bg-foreground py-3 font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreatingAccount ? 'Creating account...' : 
             isSendingVerification ? 'Sending verification email...' : 
             'Sign Up'}
          </button>
        </form>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <AuthProvider>
      <SignUpContent />
    </AuthProvider>
  );
}
