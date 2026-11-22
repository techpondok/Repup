import { cn } from "@/lib/utils";

export function DataTable({ children, className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <div className="max-w-full overflow-x-auto rounded-xl focus-visible:outline-primary" role="region" aria-label="Tabel data, geser untuk kolom lainnya" tabIndex={0}><table {...props} className={cn("w-full text-sm", className)}>{children}</table></div>;
}
