"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Bell, Dumbbell, House, Activity, UserRound, Sun, Moon, MapPin, X, CalendarDays, UsersRound } from 'lucide-react';
import { MemberSignOut } from './member-sign-out';
import { useMember } from './member-provider';
import { gym, notifications } from '@/lib/member/mock';
const links = [{ path: 'dashboard', label: 'Home', icon: House }, { path: 'classes', label: 'Classes', icon: CalendarDays }, { path: 'pt', label: 'PT', icon: UsersRound }, { path: 'activity', label: 'Activity', icon: Activity }, { path: 'profile', label: 'Profile', icon: UserRound }];
function isActive(pathname: string, path: string) {
 return pathname === `/member/${path}` || pathname.startsWith(`/member/${path}/`);
}
export function MemberLayout({ children }: { children: React.ReactNode }) {
 const pathname = usePathname(); const { member } = useMember(); const [light, setLight] = useState(false); const [showNotifications, setShowNotifications] = useState(false);
 const [mounted, setMounted] = useState(false);
 useEffect(() => { const timer = setTimeout(() => setMounted(true), 0); return () => clearTimeout(timer); }, []);
 if (!mounted) return <div className="member-portal app-shell p-6" role="status"><div className="mp-skeleton"/><span className="sr-only">Loading member portal</span></div>;
 const nav = links.map(({path,label,icon:Icon}) => <Link key={path} href={`/member/${path}`} aria-current={isActive(pathname, path) ? 'page' : undefined}><Icon size={20}/><span>{label}</span>{isActive(pathname, path) && <span className="mp-nav-dot"/>}</Link>);
 return <div className={`member-portal app-shell ${light ? 'mp-light' : ''}`}><aside className="mp-sidebar"><Link className="mp-brand" href="/member/dashboard" aria-label="RepUp Member Home"><Dumbbell size={27} aria-hidden="true"/><span className="mp-brand-wordmark">rep<b>up</b></span><small>MEMBER</small></Link><div className="mp-side-label">YOUR WORKSPACE</div><nav aria-label="Member sidebar">{nav}</nav><div className="mp-side-bottom"><div className="mb-4"><MemberSignOut/></div><div className="mp-gym-mark"><Dumbbell/><div><strong>{gym.name}</strong><small>Sudirman, Jakarta</small></div></div><div className="mp-demo-label">MEMBER PORTAL · DEMO</div></div></aside><div className="mp-workspace"><header className="mp-header"><div className="mp-location"><MapPin size={16}/><strong>{gym.name}</strong><span>/ Sudirman</span></div><div className="flex items-center gap-3"><button className="mp-icon-button" aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} onClick={() => setLight(!light)}>{light ? <Moon size={19}/> : <Sun size={19}/>}</button><button className="mp-icon-button mp-notification-button" aria-label="Open notifications" aria-expanded={showNotifications} onClick={() => setShowNotifications(!showNotifications)}><Bell size={19}/><i/></button><Link className="mp-header-profile" href="/member/profile"><span className="mp-avatar">{member.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><strong>{member.name}</strong><small>Member account</small></div></Link></div></header>{showNotifications && <section className="mp-notifications mp-card" aria-label="Notifications"><div className="flex justify-between items-center"><h2>Notifications</h2><button className="mp-icon-button" aria-label="Close notifications" onClick={()=>setShowNotifications(false)}><X size={18}/></button></div>{notifications.map(n=><article key={n.id}><strong>{n.title}</strong><p className="mp-muted">{n.description}</p></article>)}</section>}<main className="mp-main">{children}<footer className="mp-footer"><span>Built for your next personal best.</span><Link href="/member/profile">Powered by <b>repup</b> <ArrowUpRight size={12}/></Link></footer></main></div><nav className="mp-bottom-nav" aria-label="Member bottom navigation">{nav}</nav></div>;
}
