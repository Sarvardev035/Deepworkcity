export default function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-border border-t-primary animate-spin" />
        <p className="text-muted text-sm font-medium">Loading EduCoin…</p>
      </div>
    </div>
  );
}
