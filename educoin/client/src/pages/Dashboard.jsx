import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import api from '../lib/axios.js';
import CountUp from '../components/CountUp.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

const SUBJECTS = ['Math', 'Science', 'Language', 'History', 'Coding', 'Other'];
const SUBJECT_ICONS = { Math: '🔢', Science: '🔬', Language: '💬', History: '📜', Coding: '💻', Other: '📚' };

const LEVEL_COLORS = ['', 'from-slate-400 to-slate-500', 'from-green-400 to-emerald-500',
  'from-blue-400 to-cyan-500', 'from-purple-400 to-violet-500', 'from-yellow-400 to-orange-500',
  'from-red-400 to-pink-500', 'from-primary to-accent'];

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function getLevelThreshold(level) {
  const base = [0, 100, 300, 600, 1000];
  if (level <= 5) return base[level - 1] ?? 0;
  return Math.round(base[4] * Math.pow(1.8, level - 5));
}

function getNextLevelThreshold(level) {
  return getLevelThreshold(level + 1);
}

// ── Session Result Modal ──────────────────────────────────────────────────────
function SessionModal({ result, onClose }) {
  if (!result) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{result.leveledUp ? '🎉' : '✅'}</div>
          <h2 className="text-2xl font-bold text-text mb-1">Session Complete!</h2>
          {result.leveledUp && (
            <span className="badge-primary text-sm animate-pulse-slow">
              ⬆️ Level Up! Now Level {result.newLevel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 bg-bg rounded-btn">
            <div className="text-xl mb-1">⏱️</div>
            <div className="font-bold text-text">{result.durationMinutes}m</div>
            <div className="text-xs text-muted">Duration</div>
          </div>
          <div className="text-center p-3 bg-bg rounded-btn">
            <div className="text-xl mb-1">🎯</div>
            <div className="font-bold text-text">{Math.round(result.focusScore)}%</div>
            <div className="text-xs text-muted">Focus</div>
          </div>
          <div className="text-center p-3 bg-bg rounded-btn">
            <div className="text-xl mb-1">🪙</div>
            <div className="font-bold text-primary text-lg">
              +<CountUp end={result.coinsEarned} duration={800} />
            </div>
            <div className="text-xs text-muted">Earned</div>
          </div>
        </div>

        <div className="p-3 bg-primary/10 border border-primary/20 rounded-btn text-center mb-6">
          <p className="text-sm text-muted">Total Coins</p>
          <p className="text-2xl font-bold gradient-text">
            <CountUp end={result.newTotal} duration={1200} /> 🪙
          </p>
        </div>

        <button id="session-modal-close" onClick={onClose} className="btn-primary w-full">
          Awesome! Continue
        </button>
      </div>
    </div>
  );
}

// ── Active Session Card ────────────────────────────────────────────────────────
function ActiveSessionCard({ session, onStop, isStopping }) {
  const [elapsed, setElapsed] = useState(0);
  const [focusScore, setFocusScore] = useState(100);
  const workerRef = useRef(null);

  useEffect(() => {
    // Create worker from URL (Vite can bundle it)
    workerRef.current = new Worker(new URL('../workers/timerWorker.js', import.meta.url), { type: 'module' });

    const sessionStart = new Date(session.startTime).getTime();
    const alreadyElapsed = Date.now() - sessionStart;

    workerRef.current.postMessage({ type: 'START', payload: { elapsed: alreadyElapsed } });

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        setElapsed(e.data.elapsed);
      }
    };

    return () => {
      workerRef.current?.postMessage({ type: 'RESET' });
      workerRef.current?.terminate();
    };
  }, [session.id]);

  // Simulate focus score drift ±5% every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setFocusScore((prev) => {
        const drift = (Math.random() - 0.5) * 10;
        return Math.min(100, Math.max(60, prev + drift));
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const handleStop = () => {
    workerRef.current?.postMessage({ type: 'STOP' });
    onStop(focusScore);
  };

  const focusColor = focusScore >= 85 ? 'bg-success' : focusScore >= 70 ? 'bg-accent' : 'bg-error';

  return (
    <div className="card border-primary/40 glow-primary animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-semibold text-success">Session Active</span>
        </div>
        <span className="badge-primary">
          {SUBJECT_ICONS[session.subject]} {session.subject}
        </span>
      </div>

      {/* Timer */}
      <div className="text-center py-6">
        <div className="timer-display text-6xl font-black gradient-text mb-2">
          {formatDuration(elapsed)}
        </div>
        <p className="text-muted text-sm">Keep going — you're doing great!</p>
      </div>

      {/* Focus score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted">Focus Score</span>
          <span className="text-sm font-bold text-text">{Math.round(focusScore)}%</span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill focus-bar-active ${focusColor}`}
            style={{ width: `${focusScore}%` }}
          />
        </div>
        <p className="text-xs text-muted mt-1 text-right">
          {focusScore >= 85 ? '🔥 Great focus!' : focusScore >= 70 ? '👍 Stay focused' : '⚠️ Refocus!'}
        </p>
      </div>

      <button
        id="stop-session-btn"
        onClick={handleStop}
        disabled={isStopping}
        className="btn-danger w-full flex items-center justify-center gap-2"
      >
        {isStopping ? (
          <><div className="w-4 h-4 border-2 border-error/30 border-t-error rounded-full animate-spin" /> Saving…</>
        ) : (
          '⏹ Stop Session'
        )}
      </button>
    </div>
  );
}

// ── Hero Level Card ────────────────────────────────────────────────────────────
function HeroCard({ stats, isLoading }) {
  if (isLoading) return <SkeletonCard className="h-48" />;
  if (!stats) return null;

  const { level, coins, nextLevelThreshold, currentLevelThreshold, totalStudyHours } = stats;
  const progress = nextLevelThreshold
    ? Math.min(100, ((coins - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)) * 100)
    : 100;

  const gradient = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];

  return (
    <div className="card bg-gradient-hero border-primary/30 overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <p className="text-muted text-sm font-medium mb-1">Current Level</p>
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl font-black text-white shadow-lg`}>
              {level}
            </div>
            <div>
              <div className="text-2xl font-black text-text">Level {level}</div>
              <div className="text-sm text-muted">{totalStudyHours}h studied this week</div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-muted text-sm">Total Coins</p>
          <p className="text-3xl font-black gradient-text">
            <CountUp end={coins} duration={1000} /> 🪙
          </p>
        </div>
      </div>

      {/* XP progress */}
      <div>
        <div className="flex justify-between text-xs text-muted mb-2">
          <span>Level {level}</span>
          <span>{nextLevelThreshold ? `${coins - currentLevelThreshold} / ${nextLevelThreshold - currentLevelThreshold} XP` : 'Max Level! 🏆'}</span>
          {nextLevelThreshold && <span>Level {level + 1}</span>}
        </div>
        <div className="progress-track h-3">
          <div
            className="progress-fill bg-gradient-to-r from-primary to-accent"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [sessionResult, setSessionResult] = useState(null);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['user', 'stats'],
    queryFn: () => api.get('/user/stats').then((r) => r.data),
  });

  const { data: activeSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.get('/sessions/active').then((r) => r.data.session),
    refetchInterval: 30000,
  });

  const startMutation = useMutation({
    mutationFn: (subject) => api.post('/sessions/start', { subject }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', 'active'] });
      setShowSubjectPicker(false);
    },
  });

  const stopMutation = useMutation({
    mutationFn: ({ sessionId, focusScore }) =>
      api.post('/sessions/end', { sessionId, focusScore }),
    onSuccess: (res) => {
      const data = res.data;
      setSessionResult({
        coinsEarned: data.coinsEarned,
        newTotal: data.newTotal,
        newLevel: data.newLevel,
        leveledUp: data.leveledUp,
        durationMinutes: data.session.durationMinutes,
        focusScore: data.session.focusScore,
      });
      queryClient.invalidateQueries({ queryKey: ['sessions', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const handleStop = useCallback((focusScore) => {
    if (!activeSession) return;
    stopMutation.mutate({ sessionId: activeSession.id, focusScore });
  }, [activeSession, stopMutation]);

  const handleStart = (subject) => startMutation.mutate(subject);

  const closeModal = () => setSessionResult(null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-black text-text mb-1">
          Hey, {user?.username?.split('_')[0]} 👋
        </h1>
        <p className="text-muted">Ready to earn some EduCoins today?</p>
      </div>

      {/* Hero level card */}
      <HeroCard stats={statsData} isLoading={statsLoading} />

      {/* Active session OR Start button */}
      {sessionLoading ? (
        <SkeletonCard />
      ) : activeSession ? (
        <ActiveSessionCard
          session={activeSession}
          onStop={handleStop}
          isStopping={stopMutation.isPending}
        />
      ) : (
        <div className="card text-center py-10">
          {!showSubjectPicker ? (
            <>
              <div className="text-5xl mb-4">📖</div>
              <h2 className="text-xl font-bold text-text mb-2">Ready to study?</h2>
              <p className="text-muted text-sm mb-6">Start a session and earn EduCoins for every minute of focused study.</p>
              <button
                id="start-session-btn"
                onClick={() => setShowSubjectPicker(true)}
                className="btn-primary text-lg px-10 py-4 animate-glow"
              >
                🚀 Start Study Session
              </button>
            </>
          ) : (
            <div className="animate-slide-up">
              <h2 className="text-xl font-bold text-text mb-2">What are you studying?</h2>
              <p className="text-muted text-sm mb-6">Pick a subject to begin</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    id={`subject-${subject.toLowerCase()}`}
                    onClick={() => handleStart(subject)}
                    disabled={startMutation.isPending}
                    className="p-4 card-hover rounded-card flex flex-col items-center gap-2 cursor-pointer border-2 border-transparent hover:border-primary/60 transition-all duration-200 disabled:opacity-50"
                  >
                    <span className="text-2xl">{SUBJECT_ICONS[subject]}</span>
                    <span className="text-sm font-semibold text-text">{subject}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSubjectPicker(false)}
                className="btn-secondary text-sm"
              >
                ← Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick stats row */}
      {statsData && !statsLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up">
          {[
            { label: 'Total Coins', value: statsData.coins, icon: '🪙', suffix: '' },
            { label: 'Study Hours', value: statsData.totalStudyHours, icon: '⏱️', suffix: 'h' },
            { label: 'Sessions', value: statsData.totalSessions, icon: '📑', suffix: '' },
            { label: 'Global Rank', value: statsData.rank, icon: '🏅', prefix: '#' },
          ].map(({ label, value, icon, suffix, prefix }) => (
            <div key={label} className="card text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-xl font-black text-text">
                {prefix}<CountUp end={Number(value)} duration={800} />{suffix}
              </div>
              <div className="text-xs text-muted font-medium mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Session result modal */}
      <SessionModal result={sessionResult} onClose={closeModal} />
    </div>
  );
}
