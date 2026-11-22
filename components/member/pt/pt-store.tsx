"use client";
import {createContext,useContext,useRef,useState,useEffect,type ReactNode} from 'react';
import {createPTState,ptTransition,type PTAction,type PTState} from '@/lib/member/pt';
type Result = {state:PTState;error?:string};
const Context=createContext<{state:PTState;dispatch:(action:PTAction)=>Result;reset:()=>void}|null>(null);
// One in-memory preview shared by member and staff routes. Never persisted or sent to an API.
export function PTPreviewProvider({children}:{children:ReactNode}) {
 const [state,setState]=useState(createPTState); const current=useRef(state);
 function dispatch(action:PTAction){const result=ptTransition(current.current,action);if(!result.error){current.current=result.state;setState(result.state);}return result;}
 function reset(){const empty=createPTState();current.current=empty;setState(empty);}
 return <Context.Provider value={{state,dispatch,reset}}>{children}</Context.Provider>;
}
export function usePTPreview(){const value=useContext(Context);if(!value)throw new Error('PTPreviewProvider is required');return value;}
export function usePTClock(){const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);return now;}
