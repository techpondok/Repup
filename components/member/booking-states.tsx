import Link from 'next/link';
import { CalendarDays, CircleCheck, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ title, description, href, action, children }: { title: string; description: string; href?: string; action?: string; children?: ReactNode }) {
  return <section className="mp-card py-12 text-center"><CalendarDays className="mx-auto mb-5 text-primary" size={36} aria-hidden="true"/><h2>{title}</h2><p className="mp-muted mx-auto mt-3 max-w-md">{description}</p>{href && <Link className="mp-button mt-5" href={href}>{action ?? 'Explore'}</Link>}{children}</section>;
}
export function SuccessState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <section className="rounded-xl border border-line bg-primary-tint p-5" role="status"><div className="flex items-start gap-3"><CircleCheck className="shrink-0 text-primary" size={22}/><div className="min-w-0"><h2>{title}</h2><p className="mp-muted mt-2">{description}</p>{children}</div></div></section>;
}
export function LoadingSkeleton() { return <div className="mp-grid" role="status" aria-label="Loading training details"><div className="mp-skeleton"/><div className="mp-skeleton"/><span className="sr-only">Loading…</span></div>; }
export function BookingError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="rounded-xl border border-danger p-4" role="alert"><p className="text-sm">{message}</p>{onRetry && <button type="button" className="mp-button secondary mt-3" onClick={onRetry}><RefreshCw size={15}/>Try again</button>}</div>;
}
