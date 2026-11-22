import { MemberProvider } from '@/components/member/member-provider';
import { MemberLayout } from '@/components/member/member-layout';
import { PTProvider } from '@/components/member/pt/pt-provider';
import './member.css';
export const dynamic = 'force-dynamic';
export default function Layout({ children }: { children: React.ReactNode }) { return <MemberProvider><PTProvider><MemberLayout>{children}</MemberLayout></PTProvider></MemberProvider>; }
