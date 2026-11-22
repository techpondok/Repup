import { TrainerDemoProvider } from "@/components/trainers/trainer-demo-provider";
import { ClassProvider } from '@/components/member/classes/class-provider';
import { StoreProvider } from '@/components/store/store-provider';
import { PTPreviewProvider } from '@/components/member/pt/pt-store';
import type { Metadata } from "next";
import "./globals.css";
import "./ecosystem.css";
import "./app-theme.css";

export const metadata: Metadata = {
  title: "RepUp — Workout, Progress & Gym Platform",
  description:
    "Track workouts, measure progress, connect with friends, and experience your gym through RepUp. RepUp for Business helps gyms manage memberships, payments, check-ins, classes, trainers, and renewals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body suppressHydrationWarning><StoreProvider><PTPreviewProvider><ClassProvider><TrainerDemoProvider>{children}</TrainerDemoProvider></ClassProvider></PTPreviewProvider></StoreProvider></body>
    </html>
  );
}
