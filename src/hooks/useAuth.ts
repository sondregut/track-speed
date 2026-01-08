/**
 * Authentication Hook for Track Speed
 *
 * Provides auth state and methods for sign in, sign up, and sign out.
 * Supports email/password and Apple Sign In.
 */

import { useEffect, useState, useCallback } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: AuthError | null;
}

interface AuthActions {
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<boolean>;
  signInWithApple: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
}

export function useAuth(): AuthState & AuthActions {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
    }

    setProfile(data);
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }

      if (event === 'SIGNED_OUT') {
        setError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign in with email/password
  const signInWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError);
      return false;
    }

    return true;
  }, []);

  // Sign up with email/password
  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName?: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      setIsLoading(false);

      if (signUpError) {
        setError(signUpError);
        return false;
      }

      return true;
    },
    []
  );

  // Sign in with Apple
  const signInWithApple = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const { error: appleError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
    });

    setIsLoading(false);

    if (appleError) {
      setError(appleError);
      return false;
    }

    return true;
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsLoading(false);
  }, []);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // Update profile
  const updateProfile = useCallback(
    async (updates: Partial<Profile>): Promise<boolean> => {
      if (!user) return false;

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return false;
      }

      await fetchProfile(user.id);
      return true;
    },
    [user, fetchProfile]
  );

  return {
    session,
    user,
    profile,
    isLoading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signOut,
    refreshProfile,
    updateProfile,
  };
}
