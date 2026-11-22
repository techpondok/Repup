"use client";
import {createContext,useContext,type ReactNode} from 'react';
import {type PTAction,type PTState} from '@/lib/member/pt';
import {useMember} from '@/components/member/member-provider';
import {usePTPreview} from './pt-store';
const Context=createContext<{state:PTState;act:(action:PTAction)=>boolean}|null>(null);
export function PTProvider({children}:{children:ReactNode}){const {state,dispatch}=usePTPreview();const {notify}=useMember();function act(action:PTAction){const result=dispatch(action);if(result.error){notify(result.error);return false;}return true;}return <Context.Provider value={{state,act}}>{children}</Context.Provider>}
export function usePT(){const value=useContext(Context);if(!value)throw new Error('PTProvider is required');return value;}
