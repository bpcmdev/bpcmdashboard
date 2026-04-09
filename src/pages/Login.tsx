import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const TICKER_PILLS = [
  'Earned Media', 'Share of Voice', 'Influencer ROI', 'AI Visibility',
  'Sentiment', 'TikTok Shop', 'Corporate Comms', 'Partnerships',
];

const Login = () => {
  const { loading: authLoading } = useAuth(false);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials or unauthorised email domain');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: 'email profile openid',
      },
    });
    if (authError) {
      setError('Invalid credentials or unauthorised email domain');
    }
  };

  const doubled = [...TICKER_PILLS, ...TICKER_PILLS, ...TICKER_PILLS];

  return (
    <div className="h-screen relative overflow-hidden" style={{ backgroundColor: '#0a1628' }}>
      {/* Floating orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="relative z-10 h-full flex flex-col-reverse lg:flex-row overflow-auto">
        {/* Left panel */}
        <div className="flex-1 hidden lg:flex flex-col justify-between p-8 md:p-12 lg:p-16">
          {/* Logo */}
          <div>
            <h1 className="text-[28px] font-bold text-white tracking-[0.18em]">BPCM</h1>
            <p className="text-[10px] tracking-[0.15em] uppercase mt-1" style={{ color: '#3b82f6' }}>
              INTELLIGENCE PLATFORM
            </p>
          </div>

          {/* Tagline */}
          <div className="my-auto py-12 lg:py-0 max-w-lg">
            <h2 className="text-[28px] md:text-[32px] font-normal text-white leading-snug">
              Where <em className="not-italic italic" style={{ color: '#93c5fd' }}>stories</em> move people and markets.
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
              Intelligence built for the agencies shaping culture. See your brand's impact — earned, social, and AI — in one place.
            </p>
          </div>

          {/* Ticker */}
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-live" />
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-green-400">LIVE INTELLIGENCE</span>
            </div>
            <div className="overflow-hidden flex-1">
              <div className="flex gap-2 animate-ticker-login whitespace-nowrap">
                {doubled.map((pill, i) => (
                  <span
                    key={i}
                    className="inline-block text-[10px] px-3 py-1 rounded-full border whitespace-nowrap"
                    style={{ color: '#94a3b8', borderColor: 'rgba(148,163,184,0.2)' }}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex items-center justify-center p-6 md:p-12 lg:p-16 lg:w-[480px] shrink-0">
          <div className="w-full max-w-sm bg-white rounded-2xl p-8 space-y-6 shadow-2xl">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
              <p className="text-sm text-gray-500">Sign in to access your dashboard</p>
            </div>

            {/* Microsoft SSO */}
            <Button
              onClick={handleMicrosoftLogin}
              className="w-full h-11 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-medium text-sm shadow-sm"
              variant="outline"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Continue with Microsoft
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or sign in with email</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email/Password */}
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <Input
                type="email"
                placeholder="you@yourbrand.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
              />
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              <Button
                type="submit"
                disabled={submitting || authLoading}
                className="w-full h-11 font-medium text-sm text-white"
                style={{ backgroundColor: '#0a1628' }}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center space-y-1 pt-2">
              <p className="text-[11px] text-gray-400">Restricted to authorized brand accounts</p>
              <p className="text-[10px] text-gray-300">New York · Los Angeles · London</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
