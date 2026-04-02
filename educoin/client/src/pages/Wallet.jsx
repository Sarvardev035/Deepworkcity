import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios.js';
import CountUp from '../components/CountUp.jsx';

const TX_ICONS = { EARNED: '⬆️', SPENT: '⬇️' };

function TransactionRow({ tx }) {
  const isEarned = tx.type === 'EARNED';
  const date = new Date(tx.createdAt);

  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-border hover:bg-card-hover transition-colors duration-200">
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
          isEarned ? 'bg-success/10 border border-success/30' : 'bg-error/10 border border-error/30'
        }`}
      >
        {TX_ICONS[tx.type]}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{tx.description}</p>
        <p className="text-xs text-muted mt-0.5">
          {date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' · '}
          {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Amount */}
      <div
        className={`font-black text-base flex-shrink-0 ${isEarned ? 'text-success' : 'text-error'}`}
      >
        {isEarned ? '+' : '-'}{tx.amount} 🪙
      </div>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton skeleton-shimmer rounded-card h-32" />
      <div className="card p-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border">
            <div className="skeleton skeleton-shimmer w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton skeleton-shimmer h-4 w-3/4 rounded" />
              <div className="skeleton skeleton-shimmer h-3 w-1/3 rounded" />
            </div>
            <div className="skeleton skeleton-shimmer h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Wallet() {
  const { data, isLoading } = useQuery({
    queryKey: ['user', 'wallet'],
    queryFn: () => api.get('/user/wallet').then((r) => r.data),
  });

  const totalEarned = data?.transactions
    ?.filter((t) => t.type === 'EARNED')
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  const totalSpent = data?.transactions
    ?.filter((t) => t.type === 'SPENT')
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  if (isLoading) return <WalletSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-text mb-1">💰 Wallet</h1>
        <p className="text-muted">Your EduCoin transaction history</p>
      </div>

      {/* Balance hero */}
      <div className="card bg-gradient-hero border-primary/30 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 text-center py-4">
          <p className="text-muted text-sm font-medium mb-2">Total Balance</p>
          <div className="text-6xl font-black gradient-text mb-1">
            <CountUp end={data?.balance ?? 0} duration={1200} />
          </div>
          <p className="text-muted text-lg">🪙 EduCoins</p>
        </div>

        {/* Sub-stats */}
        <div className="relative z-10 grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <p className="text-success font-black text-xl">+<CountUp end={totalEarned} duration={800} /></p>
            <p className="text-xs text-muted">Total Earned</p>
          </div>
          <div className="text-center">
            <p className="text-error font-black text-xl">-<CountUp end={totalSpent} duration={800} /></p>
            <p className="text-xs text-muted">Total Spent</p>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-text">Transaction History</h2>
          <span className="text-xs text-muted">{data?.transactions?.length ?? 0} transactions</span>
        </div>

        {!data?.transactions?.length ? (
          <div className="text-center py-16 text-muted">
            <div className="text-5xl mb-3">💸</div>
            <p className="font-medium">No transactions yet</p>
            <p className="text-sm mt-1">Complete a study session to earn your first EduCoins!</p>
          </div>
        ) : (
          <div>
            {data.transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
