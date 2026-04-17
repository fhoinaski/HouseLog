export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6 lg:p-8">
      <div className="h-8 w-48 bg-[var(--muted)] rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-[var(--muted)] rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-[var(--muted)] rounded-xl" />
    </div>
  );
}
