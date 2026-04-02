import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import CountUp from './CountUp.jsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { to: '/wallet', label: 'Wallet', icon: '💰' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 select-none">
            <span className="text-2xl">🎓</span>
            <span className="font-bold text-lg gradient-text">EduCoin</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
                }
              >
                <span>{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="flex items-center gap-3">
            {/* Coin balance */}
            <div className="hidden sm:flex items-center gap-1.5 badge-primary px-3 py-1.5 rounded-full">
              <span className="text-base">🪙</span>
              <span className="font-bold text-sm">
                <CountUp end={user?.totalCoins ?? 0} duration={800} />
              </span>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                {user?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="hidden sm:block text-sm font-medium text-text">
                {user?.username}
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="btn-icon text-xs"
              title="Logout"
            >
              ↩
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-md border-t border-border z-40">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-btn transition-all duration-200 ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              <span className="text-xl">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="md:hidden h-16" />
    </div>
  );
}
