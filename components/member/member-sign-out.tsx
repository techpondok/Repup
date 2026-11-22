"use client";
import {useStore} from '@/components/store/store-provider';
import {useFormStatus} from 'react-dom';
import {LogOut} from 'lucide-react';
import {signOut} from '@/app/actions/auth';
import {usePTPreview} from './pt/pt-store';
function SignOutButton(){
 const {pending}=useFormStatus();
 return <button type="submit" className="mp-button secondary w-full" disabled={pending} aria-busy={pending}><LogOut size={16}/>{pending?'Keluar...':'Keluar / ganti akun'}</button>;
}
export function MemberSignOut(){
 const {reset}=usePTPreview();const {reset:resetStore}=useStore();
 return <form action={signOut} onSubmit={()=>{reset();resetStore();}}><SignOutButton/></form>;
}
