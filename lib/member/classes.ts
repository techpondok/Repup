export type ClassCategory = 'Yoga' | 'Pilates' | 'Zumba' | 'HIIT' | 'Strength' | 'Strength Training' | 'Boxing' | 'Cycling' | 'Functional Training' | 'Other';
export interface GymClass { id: string; name: string; category: ClassCategory; description: string; coach: string; coachBio: string; image: string; difficulty: string }
export interface ClassRules {
  bookingRequired: boolean; opensMinutes: number; closesMinutes: number; waitlistLimit: number;
  minimum: number; access: 'active' | 'packages' | 'walk-in'; packages: string[];
  paid: boolean; memberPrice: number; walkInPrice: number; currency: 'IDR';
  qr: boolean; manual: boolean; checkInMinutes: number; lateMinutes: number;
}
export interface ClassSchedule extends GymClass { startsAt: string; duration: number; branch: string; studio: string; capacity: number; enrolled: number; status: 'scheduled' | 'closed' | 'cancelled'; waitlistEnabled: boolean; cancellationHours: number; visibility?: 'draft' | 'published'; seriesId?: string; attendanceId?: string; trainerId?: string; branchId?: string; rules?: ClassRules }
export interface ClassBooking { id: string; classId: string; reference: string; status: 'confirmed' | 'cancelled'; attendance: 'pending' | 'attended' | 'no-show'; walkIn?: boolean; createdAt: string }
export interface ClassWaitlistEntry { id: string; classId: string; member: boolean; walkIn?: boolean; status: 'waiting' | 'offered'; joinedAt: string; offerExpiresAt?: string }
export interface ClassState { schedules: ClassSchedule[]; bookings: ClassBooking[]; waitlist: ClassWaitlistEntry[]; eligibilityOverride: boolean; feedback: string; feedbackClassId?: string; success: boolean }
export type ClassDemo = 'almost-full' | 'available' | 'full' | 'booked' | 'waiting' | 'ineligible' | 'closed' | 'cancelled';
export type ClassAction = { type: 'create'; sessions: ClassSchedule[] } | { type: 'book' | 'cancel' | 'join' | 'leave' | 'release' | 'accept' | 'tick'; classId: string; eligible: boolean; memberPackage?: string; walkIn?: boolean; now: number } | { type: 'demo'; classId: string; scenario: ClassDemo; now: number };
export const classCategories: ClassCategory[] = ['Yoga', 'Pilates', 'Zumba', 'HIIT', 'Strength Training', 'Cycling', 'Boxing', 'Functional Training', 'Other'];
export const classDateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export const classTime = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const classDate = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(value));
const atDay = (now: number, offset: number, hour: number) => { const key = classDateKey(new Date(now + offset * 86400000)); return new Date(`${key}T${String(hour).padStart(2, '0')}:00:00+07:00`).toISOString(); };
export function createClassState(now = Date.now()): ClassState {
  const names = ['Morning Yoga', 'Core & Control', 'Dance Your Energy', 'The HIIT Circuit', 'Stronger Together', 'Ride the Rhythm'];
  const coaches = ['Sarah Putri', 'Coach Nadia', 'Coach Rani', 'Coach Bima', 'Coach Dimas', 'Coach Raka'];
  const photos = ['photo-1544367567-0f2fcb009e0b', 'photo-1518611012118-696072aa579a', 'photo-1517130038641-a774d04afb3c', 'photo-1517836357463-d25dfeac3438', 'photo-1534438327276-14e5300c3a48', 'photo-1534258936925-c58bed479fcb'];
  const studios = ['Studio A', 'Studio A', 'Studio B', 'Studio A', 'Studio B', 'Cycling Studio'];
  const schedules: ClassSchedule[] = classCategories.slice(0, 6).map((category, i) => ({ id: `class-${i + 1}`, name: names[i], category, description: `Build confidence and move with purpose in our ${category.toLowerCase()} class. Your coach guides every session with options for your experience and fitness level.`, coach: coaches[i], coachBio: 'Certified group fitness instructor. Supportive coaching, thoughtful programming and a focus on safe movement.', image: `https://images.unsplash.com/${photos[i]}?auto=format&fit=crop&w=1000&q=80`, difficulty: i < 3 ? 'All levels' : 'Intermediate', startsAt: atDay(now, i + 1, i % 2 ? 18 : 7), duration: i === 3 ? 45 : 60, branch: i % 2 ? 'Surabaya' : 'Kediri', branchId: i % 2 ? 'demo-location-surabaya' : 'demo-location-kediri', trainerId: i === 0 ? 'demo-trainer-2' : undefined, studio: studios[i], capacity: 20, enrolled: [18, 8, 20, 16, 10, 20][i], status: i === 4 ? 'closed' : i === 5 ? 'cancelled' : 'scheduled', waitlistEnabled: i !== 4, cancellationHours: 4 }));
  const historical = [0, 1, 2].map((i): ClassSchedule => ({ ...schedules[i], id: `past-${i}`, startsAt: atDay(now, -7 - i * 3, 8), enrolled: 15 }));
  return { schedules: [...schedules, ...historical], bookings: [...historical.map((item, i): ClassBooking => ({ id: `history-${i}`, classId: item.id, reference: `RUP-H00${i}`, status: i === 2 ? 'cancelled' : 'confirmed', attendance: i === 0 ? 'attended' : i === 1 ? 'no-show' : 'pending', createdAt: atDay(now, -9 - i * 3, 12) })), {
    id: 'booking-demo-hiit', classId: 'class-4', reference: 'RUP-DEMOHIIT', status: 'confirmed', attendance: 'pending',
    createdAt: new Date(now).toISOString(),
  }], waitlist: [], eligibilityOverride: true, feedback: '', success: false };
}
export const isPublishedClass = (item: ClassSchedule) => item.visibility !== 'draft';
export function classAvailability(item: ClassSchedule, now: number) {
  const starts = Date.parse(item.startsAt);
  if (item.status === 'cancelled') return 'Cancelled';
  if (!isPublishedClass(item)) return 'Draft';
  if (item.status === 'closed' || now >= starts - (item.rules?.closesMinutes ?? 0) * 60000) return 'Booking Closed';
  if (item.rules && now < starts - item.rules.opensMinutes * 60000) return 'Booking Not Open';
  return item.enrolled >= item.capacity ? 'Fully Booked' : item.capacity - item.enrolled <= 3 ? 'Almost Full' : 'Available';
}
export function classEligible(item: ClassSchedule, active: boolean, memberPackage?: string, walkIn?: boolean) {
  const access = item.rules?.access ?? 'active';
  if (walkIn) return access === 'walk-in';
  return active && (access !== 'packages' || item.rules!.packages.includes(memberPackage ?? ''));
}
export function classReducer(state: ClassState, action: ClassAction): ClassState {
  if (action.type === 'create') {
    if (!action.sessions.length || action.sessions.some(session => state.schedules.some(existing => existing.id === session.id))) return state;
    return { ...state, schedules: [...state.schedules, ...action.sessions], feedbackClassId: undefined, feedback: action.sessions[0].visibility === 'draft' ? 'Class draft saved.' : 'Class published.', success: true };
  }
  const item = state.schedules.find(schedule => schedule.id === action.classId);
  if (item && isPublishedClass(item) && action.type !== 'demo') {
    const queue = state.waitlist.filter(entry => entry.classId !== item.id || entry.status !== 'offered' || new Date(entry.offerExpiresAt ?? 0).getTime() > action.now).map(entry => ({ ...entry }));
    let slots = item.capacity - item.enrolled - queue.filter(entry => entry.classId === item.id && entry.status === 'offered').length;
    const accepting = !['Booking Closed', 'Booking Not Open', 'Cancelled'].includes(classAvailability(item, action.now));
    for (const entry of queue.filter(entry => accepting && entry.classId === item.id && entry.status === 'waiting').sort((a,b) => a.joinedAt.localeCompare(b.joinedAt))) {
      if (slots-- <= 0) break;
      entry.status = 'offered'; entry.offerExpiresAt = new Date(action.now + 10 * 60000).toISOString();
    }
    state = { ...state, waitlist: queue };
  }
  const fail = (feedback: string) => ({ ...state, feedback, feedbackClassId: action.classId, success: false });
  if (action.type === 'tick') return state;
  if (!item || !isPublishedClass(item)) return fail('Class not found.');
  if (action.type === 'demo') {
    if (process.env.NODE_ENV === 'production') return state;
    const scenario = action.scenario;
    const bookings = state.bookings.filter(b => b.classId !== item.id);
    const waitlist = state.waitlist.filter(w => w.classId !== item.id);
    if (scenario === 'booked') bookings.push({ id: `demo-${item.id}`, classId: item.id, reference: 'RUP-DEMO123', status: 'confirmed', attendance: 'pending', createdAt: new Date(action.now).toISOString() });
    if (scenario === 'waiting') waitlist.push({ id: `waiting-${item.id}`, classId: item.id, member: true, status: 'waiting', joinedAt: new Date(action.now).toISOString() });
    return { ...state, schedules: state.schedules.map(s => s.id === item.id ? { ...s, enrolled: scenario === 'full' || scenario === 'waiting' ? s.capacity : scenario === 'booked' ? Math.max(1, s.capacity - 1) : scenario === 'almost-full' ? Math.max(0, s.capacity - 2) : Math.max(0, s.capacity - 4), status: scenario === 'closed' ? 'closed' : scenario === 'cancelled' ? 'cancelled' : 'scheduled', startsAt: s.rules ? s.startsAt : atDay(action.now, 1, 18) } : s), bookings, waitlist, eligibilityOverride: scenario !== 'ineligible', feedback: 'Demo state updated.', feedbackClassId: action.classId, success: true };
  }
  const booking = state.bookings.find(b => b.classId === item.id && b.status === 'confirmed');
  const entry = state.waitlist.find(w => w.classId === item.id && w.member);
  const available = classAvailability(item, action.now);
  const walkIn = action.type === 'accept' ? entry?.walkIn : action.walkIn;
  const eligible = classEligible(item, action.eligible && state.eligibilityOverride, action.memberPackage, walkIn);
  const reply = (next: Partial<ClassState>, feedback: string) => ({ ...state, ...next, feedback, feedbackClassId: action.classId, success: true });
  const enrollment = (change: number) => state.schedules.map(s => s.id === item.id ? { ...s, enrolled: Math.max(0, Math.min(s.capacity, s.enrolled + change)) } : s);
  const offerFirst = (list: ClassWaitlistEntry[]) => { const first = list.filter(w => w.classId === item.id && w.status === 'waiting').sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0]; return first ? list.map(w => w.id === first.id ? { ...w, status: 'offered' as const, offerExpiresAt: new Date(action.now + 10 * 60000).toISOString() } : w) : list; };
  if (action.type === 'cancel') {
    if (item.status === 'cancelled') return fail('This class has been cancelled.');
    if (!booking) return fail('There is no confirmed booking to cancel.');
    if (new Date(item.startsAt).getTime() - action.now <= item.cancellationHours * 3600000) return fail('Cancellation cutoff has passed. Contact reception.');
    return reply({ schedules: enrollment(-1), bookings: state.bookings.map(b => b.id === booking.id ? { ...b, status: 'cancelled' } : b), waitlist: offerFirst(state.waitlist) }, 'Booking cancelled. The slot is available again.');
  }
  if (action.type === 'leave') {
    if (!entry) return fail('You are not on this waiting list.');
    const list = state.waitlist.filter(w => w.id !== entry.id);
    return reply({ waitlist: entry.status === 'offered' ? offerFirst(list) : list }, 'You left the waiting list.');
  }
  if (available === 'Cancelled' || available === 'Booking Closed' || available === 'Booking Not Open') return fail('Bookings are unavailable for this class.');
  if (action.type === 'release') {
    if (process.env.NODE_ENV === 'production' && !entry) return state;
    return reply({ schedules: enrollment(-1), waitlist: offerFirst(state.waitlist) }, 'Demo: a slot opened. The first waiting member receives a ten-minute offer.');
  }
  if (!eligible) return fail('An active, valid gym membership is required.');
  if (booking) return fail('You already booked this class.');
  if (item.rules && !item.rules.bookingRequired) return fail('No reservation is required for this class.');
  if (action.type === 'join') {
    if (!item.waitlistEnabled || available !== 'Fully Booked') return fail('Waiting list is only available for eligible full classes.');
    if (entry) return fail('You are already on this waiting list.');
    if (state.waitlist.filter(w => w.classId === item.id).length >= (item.rules?.waitlistLimit ?? Infinity)) return fail('The waiting list is full.');
    return reply({ waitlist: [...state.waitlist, { id: `WL-${action.now}`, classId: item.id, member: true, walkIn, status: 'waiting', joinedAt: new Date(action.now).toISOString() }] }, 'You joined the waiting list. We will offer a slot in queue order.');
  }
  const offered = state.waitlist.filter(w => w.classId === item.id && w.status === 'offered' && new Date(w.offerExpiresAt ?? 0).getTime() > action.now);
  if (action.type === 'accept' && (!entry || entry.status !== 'offered' || new Date(entry.offerExpiresAt ?? 0).getTime() <= action.now)) return fail('This slot offer has expired. Leave and rejoin the waiting list.');
  if (action.type === 'book' && entry) return fail('Use your waiting-list offer or leave the queue before booking.');
  if (item.enrolled >= item.capacity || (action.type === 'book' && item.capacity - item.enrolled <= offered.length)) return fail('No unreserved slots remain.');
  const reference = `RUP-${action.now.toString(36).toUpperCase()}`;
  return reply({ schedules: enrollment(1), bookings: [...state.bookings, { id: reference, classId: item.id, reference, status: 'confirmed', attendance: 'pending', walkIn, createdAt: new Date(action.now).toISOString() }], waitlist: state.waitlist.filter(w => !(w.classId === item.id && w.member)) }, `Booking confirmed: ${reference}. Attendance will be recorded separately by the gym.`);
}
