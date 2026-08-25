export default function BoardLoading({ error }: { error: string | null }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 text-center">
      {error ? (
        <p className="text-sm text-red-600">Couldn&apos;t load the game data. Please refresh to try again.</p>
      ) : (
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-400 animate-pulse">Loading the board…</p>
      )}
    </div>
  );
}
