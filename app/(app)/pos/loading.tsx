export default function Loading() {
  return <div role="status" aria-label="Loading cashier store" className="space-y-5"><div className="h-10 w-56 animate-pulse rounded-lg bg-elevated"/><div className="grid gap-5 lg:grid-cols-2"><div className="h-72 animate-pulse rounded-xl bg-elevated"/><div className="h-72 animate-pulse rounded-xl bg-elevated"/></div><span className="sr-only">Loading cashier store...</span></div>;
}
