import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "RepUp for Business — Gym Management Software", description: "Manage gym members, memberships, payments, QR check-ins, classes, trainers, renewals, and multiple locations with RepUp." };

export default function BusinessPage() {
  return <main className="business-entry"><Link href="/" className="ecosystem-logo">REP<span>UP</span></Link><p className="eco-kicker lime">REPUP FOR BUSINESS</p><h1>RUN YOUR GYM.<br/><em>GROW YOUR BUSINESS.</em></h1><p>Manage members, memberships, payments, QR check-ins, classes, trainers, renewals, and performance from one connected platform.</p><div className="eco-actions"><Link href="/register" className="eco-button">Start with RepUp <span>↗</span></Link><Link href="/" className="eco-outline">Explore the ecosystem <span>↗</span></Link></div></main>;
}