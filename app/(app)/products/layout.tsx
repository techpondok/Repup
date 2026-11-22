import {StoreStaffBoundary} from '@/components/store/staff-boundary';
export default function Layout({children}:{children:React.ReactNode}){
 return <StoreStaffBoundary mode="products">{children}</StoreStaffBoundary>;
}
