import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const init = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      if (token && (type === 'invite' || type === 'recovery')) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as 'invite' | 'recovery',
        });
        if (error) {
          setError('Invalid or expired link.');
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
        const meta = (data.session.user.user_metadata ?? {}) as Record<string, unknown>;
        setFullName((meta.full_name as string) || data.session.user.email || '');
      } else {
        setError('Invalid or expired link. Please request a new invite.');
      }
    };
    init();
  }, [searchParams]);

  const handleSubmit = async () => {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F5F5' }}>
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-black/5 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(225_70%_35%/0.08)] mb-2">
            <Lock className="w-5 h-5" style={{ color: '#1A3A8F' }} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Set your password</h1>
          <p className="text-sm text-muted-foreground">Create a password to access your dashboard.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm py-2.5 px-3 rounded bg-[hsl(0_70%_50%/0.08)] text-[hsl(0_70%_45%)] border border-[hsl(0_70%_50%/0.2)]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {ready ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a secure password"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Confirm Password</label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="h-11"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-11 font-medium"
              style={{ backgroundColor: '#1A3A8F' }}
            >
              {loading ? 'Setting password…' : 'Set Password & Sign In'}
            </Button>
          </div>
        ) : !error ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            Verifying your invite link…
          </div>
        ) : null}
      </div>
    </div>
  );
}
