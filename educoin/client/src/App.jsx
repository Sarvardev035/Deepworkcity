import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Layout from './components/Layout.jsx';
import LoadingFallback from './components/LoadingFallback.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Stats = lazy(() => import('./pages/Stats.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Wallet = lazy(() => import('./pages/Wallet.jsx'));

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  // Only redirect if we're sure the user is authenticated (not while loading)
  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<PublicRoute><AuthPage mode="login" /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><AuthPage mode="register" /></PublicRoute>} />

            {/* Protected */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <Dashboard />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="stats" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <Stats />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="leaderboard" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <Leaderboard />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="wallet" element={
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <Wallet />
                  </Suspense>
                </ErrorBoundary>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
