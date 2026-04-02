import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import api from '../lib/axios.js';
import CountUp from '../components/CountUp.jsx';
import { SkeletonLeaderboard } from '../components/Skeleton.jsx';

const MEDAL_COLORS = {
  1: { border: 'border-gold/50', bg: 'bg-gold/10', text: 'text-gold', icon: '🥇', label: 'gold' },
  2: { border: 'border-silver/50', bg: 'bg-silver/10', text: 'text-silver', icon: '🥈', label: 'silver' },
  3: { border: 'border-bronze/50', bg: 'bg-bronze/10', text: 'text-bronze', icon: '🥉', label: 'bronze' },
};

function PodiumCard({ user, rank }) {
  const medal = MEDAL_COLORS[rank];
  const heightClass = rank === 1 ? 'pt-4' : rank === 2 ? 'pt-8' : 'pt-12';

  return (
    <div className={`flex flex-col items-center gap-3 ${heightClass}`}>
      <div className="text-3xl">{medal.icon}</div>
      <div
        className={`w-16 h-16 rounded-full border-2 ${medal.border} ${medal.bg} flex items-center justify-center text-white font-black text-xl shadow-lg`}
        style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
      >
        <span className={medal.text}>{user.username?.[0]?.toUpperCase()}</span>
      </div>
      <div className="text-center">
        <p className={`font-bold text-sm ${medal.text}`}>{user.username}</p>
        <p className="text-xs text-muted">Lv.{user.level}</p>
        <p className="text-sm font-black text-text mt-0.5">{user.totalCoins.toLocaleString()} 🪙</p>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { user: currentUser } = useAuth();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/leaderboard').then((r) => r.data),
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });

  const leaders = data?.leaders ?? [];
  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-text mb-1">🏆 Leaderboard</h1>
          <p className="text-muted">Top learners ranked by EduCoins earned</p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && (
            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}
          <span className="text-xs text-muted">Auto-refreshes every 30s</span>
        </div>
      </div>

      {isLoading ? (
        <SkeletonLeaderboard />
      ) : (
        <>
          {/* Podium — top 3 */}
          {top3.length >= 3 && (
            <div className="card bg-gradient-hero border-yellow-500/20">
              <div className="flex items-end justify-center gap-4 pb-4">
                {/* Silver (2nd) */}
                {top3[1] && <PodiumCard user={top3[1]} rank={2} />}
                {/* Gold (1st) */}
                {top3[0] && <PodiumCard user={top3[0]} rank={1} />}
                {/* Bronze (3rd) */}
                {top3[2] && <PodiumCard user={top3[2]} rank={3} />}
              </div>
              {/* Podium base */}
              <div className="grid grid-cols-3 gap-1 h-6">
                <div className="bg-silver/20 rounded-t-sm col-start-1" style={{ height: '18px', alignSelf: 'flex-end' }} />
                <div className="bg-gold/20 rounded-t-sm" />
                <div className="bg-bronze/20 rounded-t-sm" style={{ height: '12px', alignSelf: 'flex-end' }} />
              </div>
            </div>
          )}

          {/* Rest of leaderboard */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text">Full Rankings</h2>
            </div>

            {leaders.length === 0 ? (
              <div className="text-center py-12 text-muted">
                <div className="text-4xl mb-3">🏜️</div>
                <p>No users yet. Be the first to study!</p>
              </div>
            ) : (
              <div>
                {leaders.map((leader, idx) => {
                  const isCurrentUser = leader.id === currentUser?.id;
                  const medal = MEDAL_COLORS[leader.rank];

                  return (
                    <div
                      key={leader.id}
                      className={`flex items-center gap-4 px-6 py-4 border-b border-border transition-all duration-200
                        ${isCurrentUser
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-card-hover'
                        }`}
                    >
                      {/* Rank */}
                      <div className={`w-8 text-center font-black text-sm ${medal ? medal.text : 'text-muted'}`}>
                        {medal ? medal.icon : `#${leader.rank}`}
                      </div>

                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0
                          ${isCurrentUser
                            ? 'bg-gradient-to-br from-primary to-accent'
                            : 'bg-card-hover border border-border'
                          }`}
                      >
                        {leader.username?.[0]?.toUpperCase()}
                      </div>

                      {/* Username */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-primary' : 'text-text'}`}>
                            {leader.username}
                          </span>
                          {isCurrentUser && (
                            <span className="badge badge-primary text-[10px] py-0.5 flex-shrink-0">You</span>
                          )}
                        </div>
                        <span className="text-xs text-muted">Level {leader.level}</span>
                      </div>

                      {/* Coins */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-text">
                          <CountUp end={leader.totalCoins} duration={600} /> 🪙
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
