import { Card, LoadingSkeleton } from "@/components/ui/layout-bits";

export default function Loading() {
  return <div role="status" aria-label="Memuat halaman" className="space-y-6"><span className="sr-only">Memuat halaman…</span><LoadingSkeleton className="h-8 w-52" /><LoadingSkeleton className="w-72 max-w-full" /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i} className="space-y-5 p-5"><LoadingSkeleton className="w-24" /><LoadingSkeleton className="h-9 w-32 max-w-full" /><LoadingSkeleton className="w-20" /></Card>)}</div><Card className="space-y-6 p-5">{Array.from({ length: 7 }, (_, i) => <LoadingSkeleton key={i} className="h-10 w-full" />)}</Card></div>;
}
