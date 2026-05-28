import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

function needsPasswordSetup(session: Session | null): boolean {
  if (!session?.user) return false;
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  // SSO users never need to set a password.
  if (meta.auth_method === 'microsoft') return false;
  if (meta.password_set === false) return true;
  return false;
}

function isRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return /type=recovery|type=invite/.test(hash) || /recovery=true|type=recovery|type=invite/.test(search);
}

export function useAuth(requireAuth: boolean = true) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onSetPasswordRoute = location.pathname === '/set-password';

    const route = (session: Session | null) => {
      // Recovery / invite link → always force password setup.
      if (session && isRecoveryUrl() && !onSetPasswordRoute) {
        navigate('/set-password', { replace: true });
        return;
      }
      // Authenticated user who hasn't set a password yet.
      if (session && needsPasswordSetup(session) && !onSetPasswordRoute) {
        navigate('/set-password', { replace: true });
        return;
      }
      if (requireAuth && !session && !onSetPasswordRoute) {
        navigate('/login', { replace: true });
        return;
      }
      if (!requireAuth && session && !needsPasswordSetup(session) && !isRecoveryUrl()) {
        navigate('/dashboard', { replace: true });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY' && !onSetPasswordRoute) {
        navigate('/set-password', { replace: true });
        return;
      }
      route(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      route(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate, requireAuth, location.pathname]);

  return { session, loading };
}
