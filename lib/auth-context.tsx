'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { type User, type Session } from '@supabase/supabase-js';
import { type UserRole, getRole } from '@/lib/roles';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signInWithGoogle: (next?: string) => Promise<void>;
  signInWithGoogleModal: () => Promise<User>;
  signOut: () => Promise<void>;
  /**
   * Validate the session against the server (not just the cookie). Returns
   * the verified user, or null if the session is stale / the user has been
   * deleted. When null, the local session is cleared so the UI doesn't keep
   * treating a dead JWT as authenticated.
   */
  verifyUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signInWithGoogle = async (next?: string) => {
    const base = `${window.location.origin}/auth/callback`;
    const redirectTo = next ? `${base}?next=${encodeURIComponent(next)}` : base;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  };

  const signInWithGoogleModal = async (): Promise<User> => {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/popup-callback')}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Could not start Google sign-in.');

    const width = 480;
    const height = 640;
    const left = window.screenX + Math.max((window.outerWidth - width) / 2, 0);
    const top = window.screenY + Math.max((window.outerHeight - height) / 2, 0);
    const popup = window.open(
      data.url,
      'desart-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes,noopener=no`
    );
    if (!popup) throw new Error('Popup was blocked. Please allow popups and try again.');

    return new Promise<User>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        window.clearInterval(timer);
      };
      const onMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'desart:auth:success') return;
        if (settled) return;
        settled = true;
        cleanup();
        try { popup.close(); } catch { /* ignored */ }
        try {
          const { data: s } = await supabase.auth.getSession();
          if (s.session) {
            // Force the AuthProvider's onAuthStateChange to fire so `user` updates.
            await supabase.auth.setSession({
              access_token: s.session.access_token,
              refresh_token: s.session.refresh_token,
            });
          }
          const { data: u } = await supabase.auth.getUser();
          if (!u.user) {
            reject(new Error('Sign-in completed but session is missing.'));
            return;
          }
          resolve(u.user);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Sign-in failed.'));
        }
      };
      window.addEventListener('message', onMessage);
      const timer = window.setInterval(() => {
        if (popup.closed && !settled) {
          settled = true;
          cleanup();
          reject(new Error('Sign-in window was closed before completing.'));
        }
      }, 500);
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const verifyUser = async (): Promise<User | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Server rejected the JWT (user deleted, token revoked, etc.) — drop
      // the dead cookies so the UI stops treating us as signed in.
      await supabase.auth.signOut().catch(() => { /* ignored */ });
      return null;
    }
    return data.user;
  };

  const role = getRole(user);

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signInWithGoogle, signInWithGoogleModal, signOut, verifyUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
