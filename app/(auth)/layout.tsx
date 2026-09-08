import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-container">
        <Link href="/" className="auth-brand">
          REP<span>UP</span><i>.</i>
        </Link>
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
