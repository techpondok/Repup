"use client";
import { createContext, useContext, useState, type ReactNode } from 'react';
import { initialMember, initialMembership, type MembershipStatus, type Member, type MemberMembership } from '@/lib/member/mock';
type MemberContext = { member: Member; setMember: React.Dispatch<React.SetStateAction<Member>>; membership: MemberMembership; setStatus: (status: MembershipStatus) => void; renew: () => void; notify: (message: string) => void };
const Context = createContext<MemberContext | null>(null);
export function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState(initialMember);
  const [membership, setMembership] = useState(initialMembership);
  const [message, setMessage] = useState('');
  function renew() { setMembership(current => { const start = new Date(Math.max(Date.now(), new Date(current.end).getTime())); const end = new Date(start); end.setDate(end.getDate() + 30); return { ...current, status: 'active', end: end.toISOString() }; }); setMessage('Demo renewal completed. No payment was taken.'); }
  return <Context.Provider value={{ member, setMember, membership, setStatus: status => setMembership(current => ({ ...current, status })), renew, notify: setMessage }}>{children}{message && <div className="mp-toast" role="status"><span>{message}</span><button aria-label="Dismiss notification" onClick={() => setMessage('')}>×</button></div>}</Context.Provider>;
}
export function useMember() { const context = useContext(Context); if (!context) throw new Error('MemberProvider missing'); return context; }
