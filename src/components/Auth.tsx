import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { LogIn, UserPlus, Eye, EyeOff, Shield } from 'lucide-react';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isLogin || isAdminLogin) {
        const { error } = await signIn(email, password, isAdminLogin);
        if (error) throw error;
      } else {
        if (!fullName.trim()) {
          throw new Error('Full name is required');
        }
        const { error } = await signUp(email, password, fullName, phone);
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login: boolean, admin: boolean = false) => {
    setIsLogin(login);
    setIsAdminLogin(admin);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const getHeaderContent = () => {
    if (isAdminLogin) {
      return {
        icon: <Shield className="w-8 h-8 text-white" />,
        title: 'Admin Login',
        subtitle: 'Sign in to access the management dashboard',
        bgColor: 'bg-slate-700'
      };
    }
    if (isLogin) {
      return {
        icon: <LogIn className="w-8 h-8 text-white" />,
        title: 'Welcome Back',
        subtitle: 'Sign in to view your service history and rewards',
        bgColor: 'bg-emerald-500'
      };
    }
    return {
      icon: <UserPlus className="w-8 h-8 text-white" />,
      title: 'Create Account',
      subtitle: 'Join our rewards program today',
      bgColor: 'bg-emerald-500'
    };
  };

  const header = getHeaderContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 ${header.bgColor} rounded-full mb-4`}>
            {header.icon}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {header.title}
          </h1>
          <p className="text-slate-600">
            {header.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && !isAdminLogin && (
            <>
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required={!isLogin}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                  Phone (Optional)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>
            </>
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {!isLogin && !isAdminLogin && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                    confirmPassword && password !== confirmPassword
                      ? 'border-red-300 bg-red-50'
                      : confirmPassword && password === confirmPassword
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-300'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="mt-1 text-sm text-emerald-600">Passwords match</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!isLogin && !isAdminLogin && password !== confirmPassword)}
            className={`w-full font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isAdminLogin
                ? 'bg-slate-700 hover:bg-slate-800 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {loading ? 'Please wait...' : isLogin || isAdminLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {isAdminLogin ? (
            <div className="text-center">
              <button
                onClick={() => switchMode(true, false)}
                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
              >
                Back to Customer Login
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <button
                  onClick={() => switchMode(!isLogin, false)}
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                >
                  {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
              </div>
              {isLogin && (
                <div className="text-center pt-2 border-t border-slate-200">
                  <button
                    onClick={() => switchMode(true, true)}
                    className="text-slate-500 hover:text-slate-700 text-xs flex items-center justify-center gap-1 mx-auto"
                  >
                    <Shield className="w-3 h-3" />
                    Admin Login
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
