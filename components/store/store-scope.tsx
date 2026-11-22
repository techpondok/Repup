"use client";
import {createContext,useContext,type ReactNode} from 'react';
import type {StoreActor} from '@/lib/store/model';
import {STORE_BRANCHES} from '@/lib/store/model';
import {useBranchDemo} from '@/components/branches/demo-provider';
import {EmptyState} from '@/components/ui/layout-bits';
const Context=createContext<StoreActor|null>(null);
export function StoreActorProvider({actor,children}:{actor:StoreActor;children:ReactNode}){
  const scope=useBranchDemo();
  const branches=scope?.active.filter(branch=>scope.scopedIds.includes(branch.id));
  if(scope&&!branches?.length)return <EmptyState title="Pilih cabang aktif untuk mengelola Store." />;
  const value=branches?{...actor,branchIds:branches.map(branch=>branch.id),managedBranches:branches.map(branch=>branch.id)}:actor;
  return <Context.Provider key={value.branchIds.join(",")} value={value}>{children}</Context.Provider>;
}
export function useStoreActor(){const actor=useContext(Context);if(!actor)throw new Error('Store staff scope required');return actor;}
export function useStoreBranches(){
  const actor=useStoreActor();
  const scope=useBranchDemo();
  return (scope?.active??STORE_BRANCHES).filter(branch=>actor.branchIds.includes(branch.id));
}
