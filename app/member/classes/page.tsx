"use client";
import {ScheduleCalendar} from '@/components/ui/schedule-calendar';
import {classTime} from '@/lib/member/classes';
import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useClasses } from '@/components/member/classes/class-provider';
import { ClassCard, ClassNavigation, EmptyState } from '@/components/member/classes/class-components';
import { classCategories, classDateKey, classAvailability, isPublishedClass } from '@/lib/member/classes';
export default function ExploreClasses() {
 const {state}=useClasses(); const [search,setSearch]=useState(''); const [category,setCategory]=useState('all'); const [date,setDate]=useState(''); const [branch,setBranch]=useState('all');const [availability,setAvailability]=useState('all');const [now]=useState(()=>Date.now());
 const published = state.schedules.filter(isPublishedClass);
 const branches = [...new Set(published.map(item => item.branch))].sort();
 const statusFor = (item: (typeof published)[number]) => {
   const status = classAvailability(item, now);
   const booked = state.bookings.some(booking => booking.classId === item.id && booking.status === 'confirmed');
   return booked && status !== 'Cancelled' ? 'Already Booked' : status;
 };
 const matching=published.filter(item=>new Date(item.startsAt).getTime()>now&&(!search||`${item.name} ${item.coach}`.toLowerCase().includes(search.toLowerCase()))&&(category==='all'||item.category===category)&&(branch==='all'||item.branch===branch)&&(availability==='all'||statusFor(item)===availability));
 const items=matching.filter(item=>!date||classDateKey(item.startsAt)===date);
 return <div className="space-y-6"><header><p className="mp-eyebrow mb-3">FIND YOUR NEXT CHALLENGE</p><h1 className="mp-title">Explore Classes</h1><p className="mp-muted mt-3">Good energy. Great coaches. A stronger you.</p></header><ClassNavigation/><ScheduleCalendar title="Group class calendar" value={date} onDateSelect={setDate} events={matching.map(item=>({id:item.id,title:item.name,date:classDateKey(item.startsAt),time:classTime(item.startsAt),description:`${item.coach} | ${item.branch}`,status:statusFor(item),href:`/member/classes/${item.id}`}))}/><section className="mp-card space-y-5"><div className="flex gap-2 items-center"><SlidersHorizontal size={18}/><h2>Find your session</h2></div><div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4"><label className="text-xs">Search class or coach<div className="relative mt-2"><Search className="absolute left-3 top-3 text-ink-muted" size={17}/><input className="mp-field !pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Try Morning Flow" type="search"/></div></label><label className="text-xs">Category<select className="mp-field mt-2" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{classCategories.map(value=><option key={value}>{value}</option>)}</select></label><label className="text-xs">Date · WIB<input className="mp-field mt-2" type="date" min={classDateKey(new Date(now))} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="text-xs">Branch<select className="mp-field mt-2" value={branch} onChange={e=>setBranch(e.target.value)}><option value="all">All branches</option>{branches.map(item => <option key={item}>{item}</option>)}</select></label><label className="text-xs">Availability<select className="mp-field mt-2" value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">Any availability</option>{['Available','Almost Full','Fully Booked','Already Booked','Booking Not Open','Booking Closed','Cancelled'].map(value=><option key={value}>{value}</option>)}</select></label></div><button className="mp-button secondary" onClick={()=>{setSearch('');setCategory('all');setDate('');setBranch('all');setAvailability('all')}}>Reset filters</button></section><div className="flex justify-between gap-2"><h2>Move together</h2><span className="mp-muted">{items.length} classes</span></div>{items.length?<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{items.map(item => {
  const status = statusFor(item);
  const bookable = item.rules?.bookingRequired !== false;
  const actionLabel = status === 'Already Booked' ? 'View Booking' : bookable && status === 'Fully Booked' && item.waitlistEnabled ? 'Join Waiting List' : bookable && (status === 'Available' || status === 'Almost Full') ? 'Book Class' : 'View details';
  return <ClassCard key={item.id} item={item} now={now} status={status} actionLabel={actionLabel} />;
})}</div>:<EmptyState title="No classes match" description="Try another category, date or branch."/>}<p className="mp-muted text-xs">Demo schedule · all times in Asia/Jakarta (WIB). Bookings remain in this preview session only.</p></div>;
}
