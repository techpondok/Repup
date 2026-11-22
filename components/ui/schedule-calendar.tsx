"use client";
import {useId,useState} from 'react';
import Link from 'next/link';
import {ChevronLeft,ChevronRight,CalendarDays} from 'lucide-react';
import {Button} from './button';
import {FormModal} from './form-modal';
import {calendarDayKey,calendarMonthCells,isCalendarDate,shiftCalendarMonth} from '@/lib/calendar';
export interface ScheduleCalendarEvent {id:string;title:string;date:string;time?:string;description?:string;status?:string;href?:string}
export function ScheduleCalendar({title='Calendar',events,initialDate,value,onDateSelect,min,max,showAgenda=true,timezone='Asia/Jakarta'}:{title?:string;events:ScheduleCalendarEvent[];initialDate?:string;value?:string;onDateSelect?:(date:string)=>void;min?:string;max?:string;showAgenda?:boolean;timezone?:string}){
 const zone=timezone==='Asia/Jakarta'?'WIB':timezone;
 const [today]=useState(()=>timezone==='Asia/Jakarta'?calendarDayKey(new Date()):new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const [month,setMonth]=useState(()=>isCalendarDate(value||initialDate||'')?(value||initialDate)!:today);
 const [previousValue,setPreviousValue]=useState(value);
 if(value!==previousValue){setPreviousValue(value);if(value&&isCalendarDate(value))setMonth(value);}
 const [selected,setSelected]=useState('');const [detail,setDetail]=useState<ScheduleCalendarEvent|null>(null);const heading=useId();
 const selectedDay=value??selected;
 const cells=calendarMonthCells(month);
 const monthLabel=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month.slice(0,7)}-01T00:00:00Z`));
 const visible=events.filter(event=>selectedDay?event.date===selectedDay:event.date.slice(0,7)===month.slice(0,7)).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
 function changeMonth(next:string){setMonth(next);if(value===undefined)setSelected('');else if(showAgenda)onDateSelect?.('');}
 return <section aria-labelledby={heading} className="min-w-0 space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id={heading} className="font-semibold text-ink">{title}</h2><p className="mt-1 text-sm text-ink-muted">{monthLabel} | {zone}</p></div><div className="flex items-center gap-1"><Button type="button" variant="secondary" size="sm" aria-label={`${title}: previous month`} onClick={()=>changeMonth(shiftCalendarMonth(month,-1))}><ChevronLeft size={16}/></Button><Button type="button" variant="secondary" size="sm" onClick={()=>changeMonth(today)}>Today</Button><Button type="button" variant="secondary" size="sm" aria-label={`${title}: next month`} onClick={()=>changeMonth(shiftCalendarMonth(month,1))}><ChevronRight size={16}/></Button></div></div>
 <label className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">Jump to month<input aria-label={`${title}: month`} type="month" className="min-w-0 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink" value={month.slice(0,7)} min="1900-01" max="2100-12" onChange={e=>{if(isCalendarDate(`${e.target.value}-01`))changeMonth(`${e.target.value}-01`);}}/></label>
 <div className="grid grid-cols-7 gap-1" role="group" aria-label={`${title}: dates`}>
 {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(day=><div key={day} className="py-2 text-center text-xs text-ink-muted">{day}</div>)}
 {cells.map(cell=>{const count=events.filter(event=>event.date===cell.date).length;const active=selectedDay===cell.date;return <button key={cell.date} type="button" disabled={!!(min&&cell.date<min||max&&cell.date>max)} aria-pressed={active} aria-current={cell.date===today?'date':undefined} aria-label={`${cell.date}, ${count} sessions`} onClick={()=>{setSelected(cell.date);if(!cell.inMonth)setMonth(cell.date);onDateSelect?.(cell.date);}} className={`flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg border text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30 ${active?'border-primary bg-primary-tint font-semibold text-primary':cell.inMonth?'border-line text-ink hover:bg-elevated':'border-transparent text-ink-muted opacity-60'}`}><span>{cell.day}</span>{count>0&&<span className="mt-1 h-1 w-4 rounded-full bg-primary" aria-hidden="true"/>}</button>;})}
 </div>
 {showAgenda&&<div className="space-y-3 border-t border-line pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{selectedDay?`Schedule: ${selectedDay}`:'This month'}</h3>{selectedDay&&<Button type="button" size="sm" variant="ghost" onClick={()=>{setSelected('');onDateSelect?.('');}}>Show whole month</Button>}</div>{visible.length?visible.map(event=><article key={event.id} className="min-w-0 rounded-lg border border-line bg-canvas p-3"><p className="text-xs text-ink-muted">{event.date}{event.time?` | ${event.time} ${zone}`:''}</p>{event.href?<Link href={event.href} className="mt-1 inline-block min-h-10 py-2 text-sm font-semibold text-primary break-words">{event.title}</Link>:<button type="button" onClick={()=>setDetail(event)} className="mt-1 min-h-10 py-2 text-left text-sm font-semibold text-primary break-words">{event.title}</button>}{event.description&&<p className="text-xs text-ink-muted break-words">{event.description}</p>}{event.status&&<p className="mt-2 text-xs capitalize text-ink">{event.status}</p>}</article>):<div role="status" className="py-6 text-center text-sm text-ink-muted"><CalendarDays size={24} className="mx-auto mb-2"/>No sessions in this period.</div>}</div>}
 <FormModal open={!!detail} title={detail?.title||'Session details'} trigger={null} onClose={()=>setDetail(null)} size="small">{detail&&<div className="space-y-3 text-sm text-ink"><p>{detail.date} {detail.time} {zone}</p><p>{detail.description}</p><p className="capitalize">{detail.status}</p></div>}</FormModal>
 </section>;
}
