export interface Trainer { id: string; name: string; specialty: string; experience: number; branch: string; bio: string; certifications: string[]; image: string; available: boolean }
export interface PTPackage { id: string; name: string; sessions: number; price: number; duration: number; validity: number; benefits: string[] }
export interface MemberPTPackage { id: string; packageId: string; trainerId: string | null; total: number; completed: number; penalized?: number; expiresAt: string }
export interface PTSession { id: string; packageId: string; trainerId: string; startsAt: string; duration: number; branch: string; status: 'upcoming' | 'completed' | 'cancelled' | 'no-show'; focus: string; attendance?: { status: 'verified'; verifiedAt: string; trainerId: string }; penaltyCharged?: boolean }
export interface TrainerAvailability { trainerId: string; time: string; available: boolean }
export interface PTState { packages: MemberPTPackage[]; sessions: PTSession[]; selectedTrainer: string | null; unavailable: boolean; serial: number; attendanceTokens?: Record<string, { value: string; expiresAt: number }> }
export type PTScenario = 'none' | 'unassigned' | 'active' | 'exhausted' | 'expired' | 'booked' | 'unavailable';
export const trainers: Trainer[] = [
 { id:'bima', name:'Coach Bima', specialty:'Strength', experience:8, branch:'Sudirman', bio:'Build strength with sustainable habits and coaching that meets you where you are.', certifications:['NASM Certified Personal Trainer','Strength & Conditioning'], image:'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop', available:true },
 { id:'maya', name:'Coach Maya', specialty:'Weight Management', experience:6, branch:'Kemang', bio:'A balanced approach to movement, confidence, and everyday fitness.', certifications:['ACE Personal Trainer','Functional Training'], image:'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=800&auto=format&fit=crop', available:true },
 { id:'rio', name:'Coach Rio', specialty:'Athletic Performance', experience:10, branch:'Sudirman', bio:'Move better, get stronger, and build the foundation for your next challenge.', certifications:['CSCS','Sports Performance'], image:'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop', available:false },
];
export const ptPackages: PTPackage[] = [
 {id:'starter',name:'Starter PT',sessions:4,price:1200000,duration:60,validity:30,benefits:['Personal fitness assessment','Individual workout plan','One-on-one coaching']},
 {id:'progress',name:'Progress PT',sessions:8,price:2200000,duration:60,validity:60,benefits:['Everything in Starter','Weekly progress review','Nutrition habit guidance']},
 {id:'transformation',name:'Transformation PT',sessions:12,price:3000000,duration:60,validity:90,benefits:['Everything in Progress','Long-term training roadmap','Monthly fitness reassessment']},
];
export const ptSlots: TrainerAvailability[] = trainers.flatMap(t=>['09:00','11:00','14:00','17:00'].map(time=>({trainerId:t.id,time,available:t.available&&time!=='11:00'})));
export const ptDateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const ptDateLabel = (value: string) => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export const ptMoney = (value:number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
export function futurePTDate(days:number, now=Date.now()) { return ptDateKey(new Date(now+days*86400000)); }
export function createPTState(): PTState { return {packages:[],sessions:[],selectedTrainer:null,unavailable:false,serial:1}; }
export function remainingPT(state:PTState, item:MemberPTPackage, excludeSession?:string) { return Math.max(0,item.total-item.completed-(item.penalized||0)-state.sessions.filter(s=>s.packageId===item.id&&s.status==='upcoming'&&s.id!==excludeSession).length); }
export function ptBookingError(state:PTState, packageId:string, startsAt:string, membershipActive:boolean, rescheduleId?:string, now=Date.now(), membershipExpiresAt?:string):string|null {
 const item=state.packages.find(p=>p.id===packageId); const stamp=new Date(startsAt).getTime();
 if(!membershipActive)return 'An active gym membership is required.';
 if(membershipExpiresAt&&stamp+60*60000>new Date(membershipExpiresAt).getTime())return 'Renew your gym membership before booking this date.';
 if(!item)return 'Choose an active PT package first.';
 if(new Date(item.expiresAt).getTime()<=now)return 'Your PT package has expired.';
 if(!item.trainerId)return 'Choose a trainer before booking.';
 const trainer=trainers.find(t=>t.id===item.trainerId);
 if(!trainer||!trainer.available||state.unavailable)return 'Your trainer is unavailable. Choose another trainer or date.';
 if(!Number.isFinite(stamp)||stamp<=now)return 'Choose a future date and time.';
 if(stamp+60*60000>new Date(item.expiresAt).getTime())return 'The session must finish before your package expires.';
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(startsAt));
 if(!ptSlots.some(s=>s.trainerId===item.trainerId&&s.time===time&&s.available))return 'This time slot is unavailable.';
 const existing=rescheduleId?state.sessions.find(s=>s.id===rescheduleId):null;
 if(rescheduleId&&(!existing||existing.status!=='upcoming'||new Date(existing.startsAt).getTime()-now<2*3600000))return 'This session can no longer be rescheduled.';
 if(existing?.attendance)return 'Verified sessions cannot be rescheduled.';
 if(existing&&existing.packageId!==packageId)return 'Reschedule using the original PT package.';
 if(remainingPT(state,item,rescheduleId)<1)return 'All sessions are used or reserved. Choose another package.';
 if(state.sessions.some(s=>s.id!==rescheduleId&&s.status==='upcoming'&&stamp<new Date(s.startsAt).getTime()+s.duration*60000&&stamp+60*60000>new Date(s.startsAt).getTime()))return 'This time overlaps an existing PT session.';
 return null;
}
export const PT_QR_TTL = 30_000;
export function ptAttendanceWindow(session: PTSession, now: number) {
 const start = new Date(session.startsAt).getTime();
 return now >= start - 15 * 60_000 && now <= start + session.duration * 60_000;
}
export function ptAttendanceLabel(state: PTState, session: PTSession, now: number): string {
 if (session.status === 'completed') return 'Completed';
 if (session.status === 'cancelled') return 'Cancelled';
 if (session.status === 'no-show') return 'No Show';
 if (session.attendance) return 'Attendance Verified';
 if (!ptAttendanceWindow(session, now)) return now < new Date(session.startsAt).getTime() ? 'Not Yet Available' : 'Expired';
 const token = state.attendanceTokens?.[session.id];
 return token && token.expiresAt > now ? 'Ready to Scan' : token ? 'Expired' : 'Not Yet Available';
}
type PTAttendanceAction =
 | { type: 'issue-qr'; id: string; token: string; now: number }
 | { type: 'scan'; id: string; token: string; trainerId: string; branch: string; role: string; now: number }
 | { type: 'complete' | 'no-show'; id: string; trainerId: string; branch: string; role: string; now: number; chargePenalty?: boolean }
 | { type: 'attendance-demo'; now: number };
export type PTAction = PTAttendanceAction | {type:'purchase';packageId:string;trainerId:string|null;now:number}|{type:'trainer';trainerId:string;packageId?:string;now:number}|{type:'book';packageId:string;startsAt:string;membershipActive:boolean;membershipExpiresAt?:string;rescheduleId?:string;now:number}|{type:'cancel';id:string;now:number}|{type:'scenario';scenario:PTScenario;now:number};
export function ptTransition(state:PTState, action:PTAction):{state:PTState;error?:string} {
 if (action.type === 'attendance-demo') {
  const id = `PTS-${state.serial}`;
  const packageId = `PTP-${state.serial}`;
  return {state:{...state,serial:state.serial+1,packages:[...state.packages,{id:packageId,packageId:'starter',trainerId:'bima',total:4,completed:0,expiresAt:new Date(action.now+30*86400000).toISOString()}],sessions:[...state.sessions,{id,packageId,trainerId:'bima',branch:'Sudirman',startsAt:new Date(action.now-5*60000).toISOString(),duration:60,status:'upcoming',focus:'Attendance preview - Strength foundations'}]}};
 }
 if (action.type === 'issue-qr' || action.type === 'scan' || action.type === 'complete' || action.type === 'no-show') {
  const session = state.sessions.find(s=>s.id===action.id);
  const fail = (error: string) => ({state,error});
  if (!session) return fail('PT session not found.');
  if (session.status !== 'upcoming') return fail('This PT session is no longer active.');
  if (action.type === 'issue-qr') {
   if (session.attendance) return fail('Attendance is already verified.');
   if (!ptAttendanceWindow(session,action.now)) return fail('Attendance QR is available from 15 minutes before the session until it ends.');
   if (!/^pt-demo:[a-f0-9-]{36}$/.test(action.token)) return fail('Invalid PT preview token.');
   if (Object.values(state.attendanceTokens||{}).some(t=>t.value===action.token)) return fail('Generate a new token.');
   return {state:{...state,attendanceTokens:{...state.attendanceTokens,[session.id]:{value:action.token,expiresAt:Math.min(action.now+PT_QR_TTL,new Date(session.startsAt).getTime()+session.duration*60000)}}}};
  }
  if (!['TRAINER','OWNER','ADMIN','MANAGER','RECEPTIONIST'].includes(action.role)) return fail('Trainer or authorized staff access is required.');
  if (action.trainerId !== session.trainerId) return fail('This trainer is not assigned to the PT session.');
  if (action.branch !== session.branch) return fail('The branch does not match this PT session.');
  const tokens = {...state.attendanceTokens};
  delete tokens[session.id];
  if (action.type === 'scan') {
   if (session.attendance) return fail('Attendance is already verified. Duplicate scan rejected.');
   if (!ptAttendanceWindow(session,action.now)) return fail('Outside the PT attendance time window.');
   const token = state.attendanceTokens?.[session.id];
   if (!token || token.value !== action.token) return fail('Invalid QR or QR belongs to another session. Use a PT Session QR, not a Gym QR.');
   if (token.expiresAt <= action.now) return fail('This PT QR has expired. Ask the member to refresh it.');
   return {state:{...state,attendanceTokens:tokens,sessions:state.sessions.map(s=>s.id===session.id?{...s,attendance:{status:'verified',verifiedAt:new Date(action.now).toISOString(),trainerId:action.trainerId}}:s)}};
  }
  if (action.type === 'complete' && !session.attendance) return fail('Verify attendance before completing the session.');
  if (action.type === 'no-show' && (session.attendance || action.now <= new Date(session.startsAt).getTime()+session.duration*60000)) return fail('No-show is allowed only after an unverified session ends.');
  const item = state.packages.find(p=>p.id===session.packageId);
  if (!item) return fail('PT package not found.');
  const charge = action.type === 'no-show' && action.chargePenalty === true;
  return {state:{...state,attendanceTokens:tokens,packages:state.packages.map(p=>p.id===item.id?{...p,completed:p.completed+(action.type==='complete'?1:0),penalized:(p.penalized||0)+(charge?1:0)}:p),sessions:state.sessions.map(s=>s.id===session.id?{...s,status:action.type==='complete'?'completed':'no-show',penaltyCharged:charge}:s)}};
 }
 if(action.type==='purchase') { const plan=ptPackages.find(p=>p.id===action.packageId); if(!plan)return {state,error:'Package not found.'}; if(action.trainerId&&!trainers.some(t=>t.id===action.trainerId&&t.available))return {state,error:'Choose an available trainer.'}; return {state:{...state,serial:state.serial+1,packages:[...state.packages,{id:`PTP-${state.serial}`,packageId:plan.id,trainerId:action.trainerId,total:plan.sessions,completed:0,expiresAt:new Date(action.now+plan.validity*86400000).toISOString()}]}}; }
 if(action.type==='trainer') { if(!trainers.some(t=>t.id===action.trainerId&&t.available))return {state,error:'Trainer unavailable.'}; const target=action.packageId?state.packages.find(p=>p.id===action.packageId):[...state.packages].reverse().find(p=>new Date(p.expiresAt).getTime()>action.now); if(target&&state.sessions.some(s=>s.packageId===target.id&&s.status==='upcoming'))return {state,error:'Cancel upcoming sessions before changing trainers.'}; return {state:{...state,selectedTrainer:action.trainerId,unavailable:false,packages:state.packages.map(p=>p.id===target?.id?{...p,trainerId:action.trainerId}:p)}}; }
 if(action.type==='book') { const error=ptBookingError(state,action.packageId,action.startsAt,action.membershipActive,action.rescheduleId,action.now,action.membershipExpiresAt);if(error)return {state,error};const item=state.packages.find(p=>p.id===action.packageId)!;const trainer=trainers.find(t=>t.id===item.trainerId)!;const session:PTSession={id:action.rescheduleId||`PTS-${state.serial}`,packageId:item.id,trainerId:trainer.id,startsAt:action.startsAt,duration:60,branch:trainer.branch,status:'upcoming',focus:'Personalized strength & movement'};return {state:{...state,serial:state.serial+1,attendanceTokens:action.rescheduleId?Object.fromEntries(Object.entries(state.attendanceTokens||{}).filter(([id])=>id!==action.rescheduleId)):state.attendanceTokens,sessions:action.rescheduleId?state.sessions.map(s=>s.id===action.rescheduleId?session:s):[...state.sessions,session]}}; }
 if(action.type==='cancel') {const session=state.sessions.find(s=>s.id===action.id);if(session?.attendance)return {state,error:'Verified sessions cannot be cancelled.'};if(!session||session.status!=='upcoming')return {state,error:'This session is no longer available.'};if(new Date(session.startsAt).getTime()-action.now<2*3600000)return {state,error:'Cancellation closes 2 hours before your session.'};return {state:{...state,attendanceTokens:Object.fromEntries(Object.entries(state.attendanceTokens||{}).filter(([id])=>id!==action.id)),sessions:state.sessions.map(s=>s.id===action.id?{...s,status:'cancelled'}:s)}};}
 if(action.type!=='scenario')return {state,error:'Unsupported PT action.'};
 if(process.env.NODE_ENV!=='development')return {state,error:'Preview states are available in development only.'};
 if(action.scenario==='none')return {state:createPTState()};
 const expiresAt=new Date(action.now+(action.scenario==='expired'?-1:60)*86400000).toISOString();
 const item:MemberPTPackage={id:'PTP-demo',packageId:'progress',trainerId:action.scenario==='unassigned'?null:'bima',total:8,completed:action.scenario==='exhausted'?8:2,expiresAt};
 const sessions:PTSession[]=[{id:'PTS-history',packageId:item.id,trainerId:'bima',startsAt:new Date(action.now-3*86400000).toISOString(),duration:60,branch:'Sudirman',status:'completed',focus:'Strength foundations'},{id:'PTS-no-show',packageId:item.id,trainerId:'bima',startsAt:new Date(action.now-7*86400000).toISOString(),duration:60,branch:'Sudirman',status:'no-show',focus:'Movement assessment'}];
 if(action.scenario==='booked')sessions.push({id:'PTS-upcoming',packageId:item.id,trainerId:'bima',startsAt:`${futurePTDate(2,action.now)}T09:00:00+07:00`,duration:60,branch:'Sudirman',status:'upcoming',focus:'Full-body strength'});
 return {state:{packages:[item],sessions,selectedTrainer:'bima',unavailable:action.scenario==='unavailable',serial:20}};
}
