import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, Eye, EyeOff, Shield } from 'lucide-react';

const DEMO_SHOP_ID = '00000000-0000-0000-0000-000000000001';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [shopId, setShopId] = useState<string>('');
  const [hasShopParam, setHasShopParam] = useState(false);
  const [shopLookupError, setShopLookupError] = useState('');
  const [showStorageWarning, setShowStorageWarning] = useState(false);

  const { signIn, signUp, authError, clearAuthError } = useAuth();

  useEffect(() => {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      setShowStorageWarning(false);
    } catch {
      setShowStorageWarning(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopIdParam = params.get('shop');
    if (shopIdParam) {
      setShopId(shopIdParam);
      setIsSignUp(true);
      setHasShopParam(true);
    }
  }, []);

  const resolveShopId = async (value: string) => {
    if (!value) return '';

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) {
      return value;
    }

    const { data, error } = await supabase
      .from('shops')
      .select('id')
      .eq('slug', value)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return '';
    }

    return data.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShopLookupError('');
    clearAuthError();
    setLoading(true);

    try {
      if (isSignUp) {
        if (!shopId) {
          throw new Error('Please enter your shop code to create an account.');
        }
        if (!phone) {
          throw new Error('Please enter a phone number.');
        }
        const resolvedShopId = await resolveShopId(shopId);
        if (!resolvedShopId) {
          throw new Error('Invalid shop link. Please contact the shop for a valid signup link.');
        }
        const { error } = await signUp(email, password, fullName, resolvedShopId, phone);
        if (error) throw error;
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      if (message.toLowerCase().includes('shop')) {
        setShopLookupError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
          <div>
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl mb-6">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-3">DriveRewards</h1>
            <p className="text-slate-300 leading-relaxed">
              Loyalty, rewards, and service transparency in one dashboard. Keep customers coming back while giving them
              fast access to their appointments and repair history.
            </p>
          </div>
          <div className="text-sm text-slate-400">
            Secure sign-in • Shop-branded experience • Mobile-friendly
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{isSignUp ? 'Create account' : 'Welcome back'}</h2>
              <p className="text-slate-600 mt-1">
                {isSignUp ? 'Join your shop to start earning rewards.' : 'Sign in to manage your account.'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                  clearAuthError();
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${!isSignUp ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                  clearAuthError();
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isSignUp ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {showStorageWarning && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm mt-6">
              <strong>Note:</strong> Your browser's privacy settings may prevent session persistence. If you're using Safari, try disabling "Prevent Cross-Site Tracking" in Settings &gt; Safari, or use a different browser.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
            )}

            {isSignUp && (
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="(555) 555-1234"
                />
              </div>
            )}

            {isSignUp && !hasShopParam && (
              <div>
                <label htmlFor="shopCode" className="block text-sm font-medium text-slate-700 mb-1">
                  Shop Code
                </label>
                <input
                  id="shopCode"
                  type="text"
                  required
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value.trim())}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., midas-pineville"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Ask your shop for the signup code.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {isSignUp && (
                <p className="text-xs text-slate-500 mt-1">Use at least 6 characters.</p>
              )}
            </div>

            {(error || authError || shopLookupError) && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {shopLookupError || error || authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            <a href="/legal.html" className="hover:text-slate-700">Legal</a>
            <span className="mx-2">â€¢</span>
            <span>Copyright (c) 2026 DriveRewards. All rights reserved.</span>
          </div>
        </div>
      </div>
    </div>
  );
}