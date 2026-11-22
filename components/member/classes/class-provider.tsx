"use client";
import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { classReducer, createClassState, type ClassAction, type ClassState } from '@/lib/member/classes';
const Context = createContext<{state: ClassState; dispatch: React.Dispatch<ClassAction>} | null>(null);
export function ClassProvider({children}: {children: ReactNode}) { const [state, dispatch] = useReducer(classReducer, undefined, () => createClassState()); return <Context.Provider value={{state, dispatch}}>{children}</Context.Provider>; }
export function useClasses() { const context = useContext(Context); if (!context) throw new Error('ClassProvider missing'); return context; }
