import {getTenantContext} from '@/lib/tenant';
import {PageHeader,Card} from '@/components/ui/layout-bits';
import {canManageProducts,canSell,STORE_ORG_ID,type StoreActor} from '@/lib/store/model';
import {StoreActorProvider} from './store-scope';
import {StoreExperience} from './store-experience';
export async function StoreStaffBoundary({mode,children}:{mode:'products'|'cashier';children:React.ReactNode}){
 const ctx=await getTenantContext();
 if(!ctx.isDemo)return <><PageHeader title="Gym Store preview"/><Card className="p-6"><p className="text-sm text-ink-muted">Store mock tools are available in business demo mode only. Existing live POS remains separate and unchanged.</p></Card></>;
 const actor:StoreActor={role:ctx.demoRole||'',organizationId:STORE_ORG_ID,branchIds:ctx.branches.map(b=>b.id),name:ctx.profile.full_name||'Demo staff'};
 if(mode==='products'?!canManageProducts(actor):!canSell(actor))return <><PageHeader title="Access restricted"/><Card className="p-6"><p role="alert" className="text-sm text-danger">Your demo role cannot open this Store workspace.</p></Card></>;
 return <StoreActorProvider actor={actor}><StoreExperience>{children}</StoreExperience></StoreActorProvider>;
}
