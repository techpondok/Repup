"use client";
import {useEffect,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {QrCode,RefreshCw,ShieldCheck,CalendarDays,MapPin} from 'lucide-react';
import {usePTPreview,usePTClock} from './pt-store';
import {PTHeader,TrainerProfile,EmptyState} from './pt-ui';
import {ptAttendanceLabel,ptAttendanceWindow,ptDateLabel,trainers} from '@/lib/member/pt';
import {demoQRDataURL} from '@/lib/member/qr';

export function PTSessionDetail({id}:{id:string}) {
 const {state,dispatch}=usePTPreview(); const now=usePTClock();
 const [shown,setShown]=useState(false); const [automatic,setAutomatic]=useState(true);
 const [error,setError]=useState(''); const [copied,setCopied]=useState(false);
 const session=state.sessions.find(s=>s.id===id); const token=state.attendanceTokens?.[id];
 const ready=!!session&&session.status==='upcoming'&&!session.attendance&&ptAttendanceWindow(session,now);
 const expired=!!token&&token.expiresAt<=now;
 // A rotated token replaces its predecessor in the local registry; an old QR cannot replay.
 useEffect(()=>{
  if(!shown||!ready||(!automatic&&!!token)|| (token&&!expired))return;
  const timer=setTimeout(()=>{
   const result=dispatch({type:'issue-qr',id,token:`pt-demo:${crypto.randomUUID()}`,now:Date.now()});
   if(result.error)setError(result.error);
  },expired?500:0);
  return()=>clearTimeout(timer);
 },[shown,ready,automatic,token,expired,id,dispatch]);
 if(!session)return <EmptyState title="PT session not found" description="This local preview may have reset. Return to My sessions to select a booking." ><Link href="/member/pt/sessions" className="mp-button">My sessions</Link></EmptyState>;
 const trainer=trainers.find(t=>t.id===session.trainerId);
 const label=ptAttendanceLabel(state,session,now);
 const payload=token?.value||'';
 const qr=shown&&ready&&token&&!expired?demoQRDataURL(payload):'';
 function refresh(){setError('');const result=dispatch({type:'issue-qr',id,token:`pt-demo:${crypto.randomUUID()}`,now:Date.now()});if(result.error)setError(result.error);}
 return <div className="space-y-7"><PTHeader title="PT session details" description="Your personal training session and its dedicated attendance QR."/>
 <Link href="/member/pt/sessions" className="mp-button secondary">Back to My sessions</Link>
 <div className="grid lg:grid-cols-2 gap-5"><section className="mp-card space-y-5"><p className="mp-eyebrow">{session.id}</p><h2>{session.focus}</h2>{trainer&&<TrainerProfile trainer={trainer}/>}<p className="mp-muted flex items-center gap-2"><CalendarDays size={17}/>{ptDateLabel(session.startsAt)} WIB | {session.duration} min</p><p className="mp-muted flex items-center gap-2"><MapPin size={17}/>{session.branch}</p><dl className="space-y-3 text-sm"><div><dt className="mp-muted">Session status</dt><dd className="capitalize">{session.status.replace('-',' ')}</dd></div><div><dt className="mp-muted">Attendance status</dt><dd>{session.attendance?'Attendance Verified':'Not verified'}</dd></div>{session.attendance&&<div><dt className="mp-muted">Verified at</dt><dd>{ptDateLabel(session.attendance.verifiedAt)} WIB</dd></div>}{session.status==='no-show'&&<div><dt className="mp-muted">No-show policy applied</dt><dd>{session.penaltyCharged?'One credit charged':'No credit charged'}</dd></div>}</dl><p className="mp-muted text-xs">Scanning verifies attendance only. A reserved credit is consumed when the trainer completes the session, or when an explicit no-show penalty applies.</p></section>
 <section className="mp-card space-y-5 text-center"><QrCode className="mx-auto text-primary" size={28}/><h2>PT Session QR</h2><p className="mp-badge" role="status">{label}</p>
 {!shown?<button className="mp-button w-full" disabled={!ready} onClick={()=>setShown(true)}>Show Attendance QR</button>:<>{qr?<Image unoptimized src={qr} alt="Mock PT attendance QR. Not valid for production attendance or Gym Check-in." width={296} height={296} className="mx-auto w-full max-w-72 rounded-xl bg-white p-3"/>:<div className="rounded-xl border border-dashed border-line p-8 mp-muted">{session.attendance?<ShieldCheck className="mx-auto mb-3"/>:null}{label==='Not Yet Available'&&ready?'Preparing QR...':label}</div>}
 {qr&&<p className="mp-muted">Expires in {Math.max(0,Math.ceil(((token?.expiresAt||0)-now)/1000))} seconds</p>}
 <div className="flex flex-wrap justify-center gap-2"><button className="mp-button secondary" disabled={!ready} onClick={refresh}><RefreshCw size={16}/>Refresh QR</button><button className="mp-button secondary" disabled={!qr} onClick={async()=>{try{await navigator.clipboard.writeText(payload);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError('Copy unavailable. Select the preview token below.');}}}>{copied?'Copied':'Copy mock token'}</button></div>
 <label className="mp-muted flex justify-center items-center gap-2"><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>Auto-refresh QR</label>{qr&&<details className="text-left"><summary className="mp-muted cursor-pointer">Mock scan payload</summary><p className="mt-2 break-all select-all font-mono text-xs">{payload}</p></details>}</>}
 {error&&<p role="alert" className="text-danger text-sm">{error}</p>}
 <p className="mp-muted text-xs">Available 15 minutes before the session until its end. Only an assigned trainer can verify attendance in the trainer preview.</p><p className="mp-muted text-xs">Local simulation only. This QR is separate from Gym Check-in and cannot record real attendance. Opening it never marks you present.</p><Link className="mp-button secondary w-full" href="/pt-attendance">Trainer workspace | demo access required</Link>
 </section></div></div>;
}
