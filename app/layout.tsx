import type { Metadata } from "next";
import "./globals.css";
import "./ecosystem.css";

export const metadata: Metadata = {
  title: "RepUp — Workout, Progress & Gym Platform",
  description:
    "Track workouts, measure progress, connect with friends, and experience your gym through RepUp. RepUp for Business helps gyms manage memberships, payments, check-ins, classes, trainers, and renewals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
