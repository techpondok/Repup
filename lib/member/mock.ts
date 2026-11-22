export interface Member { id: string; name: string; email: string; phone: string; avatar: string }
export interface Gym { name: string }
export interface GymBranch { id: string; name: string }
export interface MembershipPlan { name: string; price: number; benefits: string[] }
export type MembershipStatus = 'active' | 'expired' | 'frozen' | 'pending' | 'none';
export interface MemberMembership { status: MembershipStatus; start: string; end: string; plan: string }
export interface Attendance { id: string; date: string; branch: string; checkIn: string; checkOut: string; duration: string; method: string; status: string }
export interface Notification { id: string; title: string; description: string }
export interface PaymentHistory { id: string; date: string; amount: number; status: string; plan: string }
const relative = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString(); };
export const initialMember: Member = { id: 'RPU-000123', name: 'Andi Pratama', email: 'andi.pratama@example.com', phone: '081234567890', avatar: '' };
export const gym: Gym = { name: 'FitZone Gym' };
export const branches: GymBranch[] = [{ id: 'sudirman', name: 'Sudirman' }, { id: 'kemang', name: 'Kemang' }];
export const plan: MembershipPlan = { name: 'Unlimited Monthly', price: 450000, benefits: ['Unlimited gym access', 'All FitZone branches', 'Locker & shower facilities', 'Fitness consultation'] };
export const initialMembership: MemberMembership = { status: 'active', start: relative(-23), end: relative(7), plan: plan.name };
export const attendance: Attendance[] = [0, 1, 3, 5, 7, 9, 10, 12, 14, 16, 18, 21, 24, 27, 30, 34, 38, 42, 48, 55, 62, 68].map((days, i) => ({ id: `visit-${i}`, date: relative(-days), branch: branches[i % 4 === 0 ? 1 : 0].name, checkIn: i % 2 ? '07:15' : '17:30', checkOut: i % 2 ? '08:30' : '18:45', duration: '1h 15m', method: 'Member QR', status: 'Completed' }));
export const notifications: Notification[] = [{ id: 'renew', title: 'Keep your momentum', description: 'Your membership expires in 7 days. Explore your renewal options.' }, { id: 'welcome', title: 'Welcome to your member space', description: 'Your membership, visits and gym access. All in one place.' }];
export const payments: PaymentHistory[] = [23, 53, 83].map((days, i) => ({ id: `PAY-00${i + 1}`, date: relative(-days), amount: plan.price, status: 'Paid', plan: plan.name }));
export const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
export const jakartaDate = (value: string | Date) => new Date(new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
