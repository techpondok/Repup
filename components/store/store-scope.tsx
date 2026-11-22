"use client";
import {createContext,useContext,type ReactNode} from 'react';
import type {StoreActor} from '@/lib/store/model';
const Context=createContext<StoreActor|null>(null);
export function StoreActorProvider({actor,children}:{actor:StoreActor;children:ReactNode}){return <Context.Provider value={actor}>{children}</Context.Provider>;}
export function useStoreActor(){const actor=useContext(Context);if(!actor)throw new Error('Store staff scope required');return actor;}
