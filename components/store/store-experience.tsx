"use client";
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {Moon,Sun,X,ShoppingBag} from 'lucide-react';
import {useStore} from './store-provider';
import {switchDemoRole} from '@/app/actions/auth';
import './store.css';
export function StoreExperience({children,member=false}:{children:ReactNode;member?:boolean}){
 const {message,dismiss}=useStore();const [light,setLight]=useState(false);
 return <div className={`store-experience min-w-0 space-y-5 ${!member&&light?'store-light':''}`}>
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"><p className="flex items-center gap-2 text-xs text-ink-muted"><ShoppingBag size={16} className="text-primary"/>GYM STORE DEMO | No real payment or stock changes</p>{!member&&<button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-xs text-ink" onClick={()=>setLight(!light)}>{light?<Moon size={15}/>:<Sun size={15}/>} {light?'Dark':'Light'}</button>}</div>
 {children}
 <details className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer text-sm text-ink-muted">Try another demo workspace</summary><p className="mt-3 text-xs text-ink-muted">Switch roles in this tab to process the same orders. Reload or logout resets this local preview. These controls only work in business demo mode.</p><div className="mt-3 flex flex-wrap gap-2">{[['CASHIER','Cashier POS'],['OWNER','Manage products']].map(([role,label])=><form action={switchDemoRole} key={role}><input type="hidden" name="role" value={role}/><button type="submit" className="min-h-10 rounded-lg border border-line px-3 text-xs text-primary">{label}</button></form>)}</div><p className="mt-3 text-xs text-ink-muted">After switching, open POS or Products from the operational menu.</p><Link href="/login" className="mt-3 inline-block min-h-10 py-2 text-xs text-primary">Choose a demo role at login</Link></details>
 {message&&<div role="status" className="fixed bottom-24 left-1/2 z-[160] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-xl border border-primary bg-surface p-4 text-sm text-ink shadow-xl"><span>{message}</span><button type="button" aria-label="Dismiss notification" onClick={dismiss} className="min-h-10 min-w-10"><X size={16}/></button></div>}
 </div>;
}
