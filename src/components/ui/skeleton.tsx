export function PageSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-6 h-8 w-52 animate-pulse rounded-md bg-white/10" />
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-lg border border-white/10 bg-white/[0.035]" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-white/10 bg-white/[0.025]" />
      </div>
    </main>
  );
}
