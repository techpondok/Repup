import { calendarDayKey, isCalendarDate } from "@/lib/calendar";
import { openSession, trainerAllowsSlot, type TrainerDetail } from "@/lib/trainer-management";
import { classCategories, classDateKey, classTime, type ClassCategory, type ClassSchedule, type ClassRules } from "./classes";

export const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const difficulties = ["All Levels", "Beginner", "Intermediate", "Advanced"];
export const defaultCover = "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80";
export const maxSessions = 100;
export const rooms = ["Studio A", "Studio B", "Cycling Studio", "Training Floor"];
export const operatingHours = { start: "06:00", end: "22:00" };
export type ClassBranch = { id: string; name: string };
export type Slot = { date: string; start: string; end: string; startsAt: string };
export type ClassDraft = {
  name: string; category: ClassCategory | ""; description: string; image: string; difficulty: string;
  duration: number; trainerId: string; branchId: string; room: string;
  recurring: boolean; date: string; start: string; days: Record<number, string>;
  endsBy: "count" | "date"; count: number; endDate: string; capacity: number;
  waitlist: boolean; cancellationMinutes: number; visibility: "draft" | "published"; rules: ClassRules;
};
export type ClassErrors = Partial<Record<keyof ClassDraft | keyof ClassRules | "schedule", string>>;

export function initialClass(branchId: string): ClassDraft {
  return {
    name: "", category: "", description: "", image: "", difficulty: difficulties[0], duration: 60,
    trainerId: "", branchId, room: "", recurring: false, date: "", start: "", days: {}, endsBy: "count", count: 12,
    endDate: "", capacity: 15, waitlist: true, cancellationMinutes: 120, visibility: "published",
    rules: { bookingRequired: true, opensMinutes: 10080, closesMinutes: 30, waitlistLimit: 5, minimum: 0,
      access: "active", packages: [], paid: false, memberPrice: 0, walkInPrice: 0, currency: "IDR",
      qr: true, manual: true, checkInMinutes: 15, lateMinutes: 10 },
  };
}
const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const integerBetween = (n: number, lower: number, upper: number) => Number.isInteger(n) && n >= lower && n <= upper;
const stamp = (date: string, time: string) => Date.parse(`${date}T${time}:00+07:00`);
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function classEndTime(start: string, duration: number) {
  if (!validTime(start) || !integerBetween(duration, 1, 960)) return "";
  const [hours, minutes] = start.split(":").map(Number);
  const end = hours * 60 + minutes + duration;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function generateClassSlots(draft: ClassDraft): { slots: Slot[]; errors: ClassErrors } {
  const errors: ClassErrors = {};
  if (!isCalendarDate(draft.date)) errors.date = "Choose a class date.";
  if (!integerBetween(draft.duration, 1, 960)) errors.duration = "Enter a duration from 1 to 960 minutes.";
  if (!draft.recurring && !validTime(draft.start)) errors.start = "Choose a start time.";
  const days = Object.entries(draft.days);
  if (draft.recurring && (!days.length || days.some(([day, time]) => !/^[0-6]$/.test(day) || !validTime(time)))) errors.days = "Select at least one day and a time for each selected day.";
  if (draft.recurring && draft.endsBy === "date" && (!isCalendarDate(draft.endDate) || draft.endDate < draft.date)) errors.endDate = "Choose an end date on or after the start date.";
  if (draft.recurring && draft.endsBy === "count" && !integerBetween(draft.count, 1, maxSessions)) errors.count = `Enter 1–${maxSessions} sessions.`;
  if (Object.keys(errors).length) return { slots: [], errors };

  const slots: Slot[] = [];
  function append(date: string, start: string) {
    slots.push({ date, start, end: classEndTime(start, draft.duration), startsAt: new Date(stamp(date, start)).toISOString() });
  }
  if (!draft.recurring) append(draft.date, draft.start);
  else {
    const first = Date.parse(draft.date);
    const until = draft.endsBy === "date" ? Date.parse(draft.endDate) : Infinity;
    const target = draft.endsBy === "count" ? draft.count : Infinity;
    for (let cursor = first; cursor <= until && slots.length < target && slots.length <= maxSessions; cursor += 86400000) {
      const time = draft.days[new Date(cursor).getUTCDay()];
      if (time) append(isoDay(cursor), time);
    }
    if (slots.length > maxSessions) errors.endDate = `Shorten the date range to ${maxSessions} sessions or fewer.`;
    if (!slots.length) errors.days = "No selected weekdays occur in this date range.";
  }
  return { slots: slots.slice(0, maxSessions), errors };
}

const overlaps = (start: string, end: string, otherStart: string, otherEnd: string) => start < otherEnd && otherStart < end;

export function validateClass(draft: ClassDraft, trainers: TrainerDetail[], branches: ClassBranch[], schedules: ClassSchedule[], now: number) {
  const { slots, errors } = generateClassSlots(draft);
  const trainer = trainers.find(item => item.trainer.id === draft.trainerId);
  const branch = branches.find(item => item.id === draft.branchId);
  const rules = draft.rules;
  if (!draft.name.trim()) errors.name = "Enter a class name.";
  if (!draft.category || !classCategories.includes(draft.category)) errors.category = "Select a category.";
  if (!trainer) errors.trainerId = "Choose an instructor.";
  else if (trainer.trainer.status !== "active") errors.trainerId = "Choose an active instructor.";
  if (!branch) errors.branchId = "Select a gym branch.";
  if (!rooms.includes(draft.room)) errors.room = "Select a studio or room.";
  if (!integerBetween(draft.capacity, 1, 1000)) errors.capacity = "Enter a capacity from 1 to 1,000.";
  if (!integerBetween(rules.minimum, 0, draft.capacity)) errors.minimum = "Minimum cannot exceed capacity.";
  if (rules.bookingRequired && draft.waitlist && !integerBetween(rules.waitlistLimit, 1, 1000)) errors.waitlistLimit = "Enter a waiting-list limit from 1 to 1,000.";
  if (rules.bookingRequired) {
    if (!integerBetween(rules.opensMinutes, 1, 525600)) errors.opensMinutes = "Enter a positive booking window up to one year.";
    if (!integerBetween(rules.closesMinutes, 0, rules.opensMinutes - 1)) errors.closesMinutes = "Closing must be closer to class time than opening.";
    if (!integerBetween(draft.cancellationMinutes, 0, rules.opensMinutes)) errors.cancellationMinutes = "Cancellation cannot close before bookings open.";
  }
  if (rules.access === "packages" && !rules.packages.length) errors.packages = "Select at least one membership package.";
  if (rules.paid && !integerBetween(rules.memberPrice, 0, Number.MAX_SAFE_INTEGER)) errors.memberPrice = "Enter a non-negative IDR amount.";
  if (rules.paid && rules.access === "walk-in" && !integerBetween(rules.walkInPrice, 0, Number.MAX_SAFE_INTEGER)) errors.walkInPrice = "Enter a non-negative IDR amount.";
  if (rules.qr || rules.manual) {
    if (!integerBetween(rules.checkInMinutes, 0, 1440)) errors.checkInMinutes = "Enter 0–1,440 minutes.";
    if (!integerBetween(rules.lateMinutes, 0, Math.max(0, draft.duration - 1))) errors.lateMinutes = "Late tolerance must be shorter than the session.";
  }
  for (const slot of slots) {
    const suffix = `${slot.date} at ${slot.start} WIB.`;
    if (Date.parse(slot.startsAt) <= now) { errors.schedule = `Choose a future time for ${suffix}`; break; }
    if (slot.start < operatingHours.start || slot.end > operatingHours.end) { errors.schedule = `Outside gym hours (${operatingHours.start}–${operatingHours.end} WIB) on ${suffix}`; break; }
    if (trainer?.sessions.some(session => openSession(session.status) && session.date === slot.date && overlaps(slot.start, slot.end, session.start, session.end))) {
      errors.schedule = `The instructor has a PT session on ${suffix}`; break;
    }
    if (trainer && !trainerAllowsSlot(trainer.trainer.availability, slot.date, slot.start, slot.end)) {
      errors.schedule = `The instructor is unavailable on ${suffix}`; break;
    }
    const conflict = schedules.find(item => {
      if (item.status === "cancelled" || item.visibility === "draft" || classDateKey(item.startsAt) !== slot.date) return false;
      const start = classTime(item.startsAt);
      const sameTrainer = item.trainerId === trainer?.trainer.id && Boolean(trainer);
      const sameRoom = (item.branchId === branch?.id || item.branch === branch?.name) && item.studio.toLowerCase() === draft.room.toLowerCase();
      return (sameTrainer || sameRoom) && overlaps(slot.start, slot.end, start, classEndTime(start, item.duration));
    });
    if (conflict) { errors.schedule = `Conflicts with ${conflict.name} on ${suffix}`; break; }
  }
  return { slots, errors, trainer, branch };
}

export function buildClassSessions(draft: ClassDraft, slots: Slot[], trainer: TrainerDetail, branch: ClassBranch, seriesId: string): ClassSchedule[] {
  return slots.map((slot, index) => ({
    id: `${seriesId}-${index + 1}`, attendanceId: `${seriesId}-attendance-${index + 1}`, seriesId,
    name: draft.name.trim(), category: draft.category as ClassCategory, description: draft.description.trim(),
    coach: trainer.trainer.name, coachBio: trainer.trainer.bio || trainer.trainer.specializations.join(", "),
    trainerId: trainer.trainer.id, image: draft.image || defaultCover, difficulty: draft.difficulty,
    startsAt: slot.startsAt, duration: draft.duration, branch: branch.name, branchId: branch.id, studio: draft.room,
    capacity: draft.capacity, enrolled: 0, status: "scheduled", visibility: draft.visibility,
    waitlistEnabled: draft.rules.bookingRequired && draft.waitlist,
    cancellationHours: draft.rules.bookingRequired ? draft.cancellationMinutes / 60 : 0,
    rules: { ...draft.rules,
      closesMinutes: draft.rules.bookingRequired ? draft.rules.closesMinutes : 0,
      opensMinutes: draft.rules.bookingRequired ? draft.rules.opensMinutes : 525600,
      waitlistLimit: draft.rules.bookingRequired && draft.waitlist ? draft.rules.waitlistLimit : 0,
      checkInMinutes: draft.rules.qr || draft.rules.manual ? draft.rules.checkInMinutes : 0,
      lateMinutes: draft.rules.qr || draft.rules.manual ? draft.rules.lateMinutes : 0,
      memberPrice: draft.rules.paid ? draft.rules.memberPrice : 0,
      walkInPrice: draft.rules.paid && draft.rules.access === "walk-in" ? draft.rules.walkInPrice : 0,
    },
  }));
}

export function yogaExample(branchId: string, now: number, trainerId: string): ClassDraft {
  const draft = initialClass(branchId);
  const date = calendarDayKey(new Date(now + 2 * 86400000));
  return { ...draft, name: "Morning Yoga", category: "Yoga", trainerId, room: "Studio A",
    recurring: true, date, days: { 1: "07:00", 3: "07:00", 5: "07:00" } };
}
