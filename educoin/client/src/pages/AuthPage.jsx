import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  delay: Math.random() * 3,
  duration: Math.random() * 4 + 3,
}));

function FloatingCoin({ x, y, size, delay, duration }) {
  return (
    <div
      className="absolute rounded-full bg-primary/20 border border-primary/30 animate-pulse-slow select-none pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${size * 6}px`,
        height: `${size * 6}px`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    />
  );
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const { login, register, loginPending, registerPending } = useAuth();
  const isLogin = mode === 'login';

  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  // Reset errors on mode change
  useEffect(() => {
    setErrors({});
    setServerError('');
  }, [mode]);

  const validate = () => {
    const newErrors = {};
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Enter a valid email';

    if (!isLogin) {
      if (!form.username) newErrors.username = 'Username is required';
      else if (form.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    }

    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 8) newErrors.password = 'Password must be at least 8 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    try {
      if (isLogin) {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ email: form.email, username: form.username, password: form.password });
      }
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const isPending = isLogin ? loginPending : registerPending;

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-hero items-center justify-center">
        {/* Animated background particles */}
        {PARTICLES.map((p) => <FloatingCoin key={p.id} {...p} />)}

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-6xl shadow-2xl glow-primary animate-glow">
            🎓
          </div>
          <div>
            <h1 className="text-5xl font-black gradient-text leading-tight mb-4">EduCoin</h1>
            <p className="text-2xl font-semibold text-text/90 mb-2">Turn discipline</p>
            <p className="text-2xl font-semibold text-accent">into currency</p>
          </div>
          <p className="text-muted text-lg max-w-xs leading-relaxed">
            Study smarter. Earn coins. Level up. Compete with the world's best learners.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['🪙 Earn EduCoins', '🏆 Leaderboard', '📊 Track Progress', '⚡ Focus Score'].map((feat) => (
              <span key={feat} className="badge badge-primary text-xs px-3 py-1.5">{feat}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:max-w-xl">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <span className="text-3xl">🎓</span>
            <span className="text-2xl font-black gradient-text">EduCoin</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text mb-2">
              {isLogin ? 'Welcome back!' : 'Start learning'}
            </h2>
            <p className="text-muted">
              {isLogin
                ? 'Sign in to continue your streak'
                : 'Create your account and start earning coins'}
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="mb-4 p-3 rounded-btn bg-error/10 border border-error/30 text-error text-sm animate-fade-in">
              ⚠️ {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange('email')}
                className={`input ${errors.email ? 'input-error' : ''}`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-error animate-fade-in">{errors.email}</p>
              )}
            </div>

            {/* Username (register only) */}
            {!isLogin && (
              <div className="animate-fade-in">
                <label htmlFor="username" className="label">Username</label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="study_champion"
                  value={form.username}
                  onChange={handleChange('username')}
                  className={`input ${errors.username ? 'input-error' : ''}`}
                />
                {errors.username && (
                  <p className="mt-1 text-xs text-error animate-fade-in">{errors.username}</p>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange('password')}
                className={`input ${errors.password ? 'input-error' : ''}`}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-error animate-fade-in">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6 py-3.5"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isLogin ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                isLogin ? '→ Sign In' : '→ Create Account'
              )}
            </button>
          </form>

          {/* Toggle link */}
          <p className="mt-6 text-center text-muted text-sm">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link
              to={isLogin ? '/register' : '/login'}
              className="text-primary hover:text-accent font-semibold transition-colors duration-200"
            >
              {isLogin ? 'Register' : 'Sign In'}
            </Link>
          </p>

          {/* Demo hint */}
          <div className="mt-8 p-3 rounded-btn bg-primary/5 border border-primary/20 text-center">
            <p className="text-muted text-xs">
              🧪 Demo seed users: <span className="text-text font-mono">alex@educoin.dev</span>
            </p>
            <p className="text-muted text-xs mt-0.5">
              Password: <span className="text-text font-mono">password123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
