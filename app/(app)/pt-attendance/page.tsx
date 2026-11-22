import {getTenantContext} from '@/lib/tenant';
import {hasDemoPermission} from '@/lib/demo/roles';
import {PageHeader,Card} from '@/components/ui/layout-bits';
import {PTAttendanceScanner} from '@/components/personal-training/pt-attendance-scanner';
export default async function Page(){
 const ctx=await getTenantContext();
 if(!ctx.isDemo)return <><PageHeader title="PT Attendance" description="Trainer attendance preview"/><Card className="p-6"><p className="text-sm text-ink-muted">Mock scanner is available only in business demo mode. Live attendance is not connected.</p></Card></>;
 if(!hasDemoPermission(ctx.demoRole,'pt.sessions.manage'))return <><PageHeader title="PT Attendance"/><Card className="p-6"><p role="alert" className="text-sm text-danger">Trainer or authorized staff role required. Switch to an authorized business demo role.</p></Card></>;
 return <PTAttendanceScanner role={ctx.demoRole!}/>;
}
