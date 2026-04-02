import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios.js';
import CountUp from '../components/CountUp.jsx';
import { SkeletonStatCards, SkeletonTable } from '../components/Skeleton.jsx';

const SUBJECT_ICONS = { Math: '🔢', Science: '🔬', Language: '💬', History: '📜', Coding: '💻', Other: '📚' };

// ── SVG bar chart (last 7 days) ────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.minutes), 1);
  const chartH = 120;
  const barW = 32;
  const gap = 8;
  const totalW = data.length * (barW + gap);
  const labelH = 24;

  const getDayLabel = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en', { weekday: 'short' });
  };

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${chartH + labelH + 16}`}
        className="w-full"
        style={{ minWidth: `${totalW}px`, maxWidth: '500px' }}
      >
        {data.map((day, i) => {
          const x = i * (barW + gap);
          const barH = max > 0 ? (day.minutes / max) * chartH : 0;
          const y = chartH - barH;
          const isToday = i === data.length - 1;

          return (
            <g key={day.date}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={6}
                fill={isToday ? '#6C5CE7' : '#2A2A3A'}
                className="transition-all duration-500"
              />
              {/* Bar fill overlay for gradient */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={6}
                fill="url(#barGrad)"
                opacity={isToday ? 1 : 0}
              />
              {/* Value label */}
              {day.minutes > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fill="#EAEAEA"
                  fontSize="10"
                  fontWeight="600"
                >
                  {day.minutes}m
                </text>
              )}
              {/* Day label */}
              <text
                x={x + barW / 2}
                y={chartH + labelH + 4}
                textAnchor="middle"
                fill={isToday ? '#6C5CE7' : '#8A8A9A'}
                fontSize="11"
                fontWeight={isToday ? '700' : '400'}
              >
                {getDayLabel(day.date)}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C5CE7" />
            <stop offset="100%" stopColor="#a29bfe" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function Stats() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user', 'stats'],
    queryFn: () => api.get('/user/stats').then((r) => r.data),
  });

  const { data: weekly, isLoading: weeklyLoading } = useQuery({
    queryKey: ['user', 'weekly-stats'],
    queryFn: () => api.get('/user/weekly-stats').then((r) => r.data.weeklyData),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['sessions', 'history'],
    queryFn: () => api.get('/sessions/history').then((r) => r.data.sessions),
  });

  const statCards = [
    { label: 'Total Coins', value: stats?.coins, icon: '🪙', color: 'text-primary' },
    { label: 'Study Hours', value: stats?.totalStudyHours, icon: '⏱️', color: 'text-accent', suffix: 'h' },
    { label: 'Sessions', value: stats?.totalSessions, icon: '📑', color: 'text-success' },
    { label: 'Global Rank', value: stats?.rank, icon: '🏅', color: 'text-yellow-400', prefix: '#' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-text mb-1">📊 Stats</h1>
        <p className="text-muted">Your learning journey at a glance</p>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <SkeletonStatCards />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon, color, suffix, prefix }) => (
            <div key={label} className="card text-center hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5">
              <div className="text-3xl mb-2">{icon}</div>
              <div className={`text-3xl font-black ${color} mb-1`}>
                {prefix}<CountUp end={Number(value ?? 0)} duration={1000} />{suffix}
              </div>
              <div className="text-sm text-muted font-medium">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Daily bar chart */}
      <div className="card">
        <h2 className="text-lg font-bold text-text mb-4">📅 Daily Study (last 7 days)</h2>
        {weeklyLoading ? (
          <div className="h-32 skeleton skeleton-shimmer rounded-btn" />
        ) : weekly?.length ? (
          <BarChart data={weekly} />
        ) : (
          <p className="text-muted text-sm text-center py-8">No study data yet. Start a session!</p>
        )}
      </div>

      {/* Session history table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text">📋 Recent Sessions</h2>
        </div>

        {historyLoading ? (
          <SkeletonTable rows={5} />
        ) : !history?.length ? (
          <div className="text-center py-12 text-muted">
            <div className="text-4xl mb-3">📭</div>
            <p>No sessions yet. Start studying to see your history!</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 px-6 py-2 bg-bg/50 text-xs font-semibold text-muted uppercase tracking-wide">
              <span>Subject</span>
              <span>Date</span>
              <span className="text-center">Duration</span>
              <span className="text-center">Focus</span>
              <span className="text-right">Coins</span>
            </div>

            {/* Rows */}
            {history.map((session) => {
              const date = new Date(session.endTime ?? session.startTime);
              const focusClass = session.focusScore >= 85 ? 'text-success' : session.focusScore >= 70 ? 'text-accent' : 'text-error';
              return (
                <div key={session.id} className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-border hover:bg-card-hover transition-colors duration-200 items-center">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                    <span>{SUBJECT_ICONS[session.subject] ?? '📚'}</span>
                    <span className="hidden sm:block">{session.subject}</span>
                  </span>
                  <span className="text-sm text-muted">
                    {date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-sm text-text text-center">
                    {session.durationMinutes}m
                  </span>
                  <span className={`text-sm font-semibold text-center ${focusClass}`}>
                    {Math.round(session.focusScore)}%
                  </span>
                  <span className="text-sm font-bold text-primary text-right">
                    +{session.coinsEarned} 🪙
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
