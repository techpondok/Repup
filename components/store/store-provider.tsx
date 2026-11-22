"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode,type Dispatch,type SetStateAction} from 'react';
import {createDemoStore} from "@/lib/store/demo-purchases";
import {storeTransition,expireStoreOrders,type StoreState,type StoreAction,type StoreResult,type CartLine} from '@/lib/store/model';
type StoreContext={state:StoreState;now:number;dispatch:(action:StoreAction)=>StoreResult;memberCart:CartLine[];setMemberCart:Dispatch<SetStateAction<CartLine[]>>;cashierCart:CartLine[];setCashierCart:Dispatch<SetStateAction<CartLine[]>>;notify:(message:string)=>void;message:string;dismiss:()=>void;reset:()=>void};
const Context=createContext<StoreContext|null>(null);
export function StoreProvider({children}:{children:ReactNode}){
 const [state,setState]=useState(createDemoStore);const current=useRef(state);const [now,setNow]=useState(()=>Date.now());
 const [memberCart,setMemberCart]=useState<CartLine[]>([]);const [cashierCart,setCashierCart]=useState<CartLine[]>([]);const [message,setMessage]=useState('');
 function dispatch(action:StoreAction){const result=storeTransition(current.current,{...action,now:action.now??Date.now()});if(result.state!==current.current){current.current=result.state;setState(result.state);}return result;}
 function reset(){const empty=createDemoStore();current.current=empty;setState(empty);setMemberCart([]);setCashierCart([]);setMessage('');}
 useEffect(()=>{const timer=setInterval(()=>{const time=Date.now();setNow(time);const next=expireStoreOrders(current.current,time);if(next!==current.current){current.current=next;setState(next);}},1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(timer);},[message]);
 return <Context.Provider value={{state,now,dispatch,memberCart,setMemberCart,cashierCart,setCashierCart,notify:setMessage,message,dismiss:()=>setMessage(''),reset}}>{children}</Context.Provider>;
}
export function useStore(){const value=useContext(Context);if(!value)throw new Error('StoreProvider is required');return value;}
