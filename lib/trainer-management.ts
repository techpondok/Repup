import { isCalendarDate } from "./calendar";

export type TrainerStatus = "active" | "inactive" | "on_leave";
export type TrainerEmployment = "full_time" | "part_time" | "freelance";
export type TrainerTimeOff = {
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  type?: "leave" | "day_off" | "unavailable";
  reason: string;
};
export type Availability = {
  weekly: { day: number; start: string; end: string; kind: "available" | "break" }[];
  timeOff: TrainerTimeOff[];
};

export interface ManagedTrainer {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  bio: string;
  specializations: string[];
  experience: number;
  certifications: string;
  employment: TrainerEmployment;
  status: TrainerStatus;
  rate: number;
  duration: number;
  photo: string | null;
  activeMembers: number;
  timezone?: string;
  availability: Availability | null;
}

export interface TrainerSession {
  id: string;
  assignmentId?: string;
  memberName: string;
  date: string;
  start: string;
  end: string;
  status: string;
  scheduledAt: string;
  packageName?: string | null;
  approvalExpiresAt?: string | null;
}

export interface TrainerMember {
  id: string;
  name: string;
  photo: string | null;
  packageName: string | null;
  status: string;
  lastSession: string | null;
  nextSession: string | null;
  remainingSessions?: number;
}

export interface TrainerDetail {
  trainer: ManagedTrainer;
  sessions: TrainerSession[];
  members: TrainerMember[];
  packages?: { id: string; name: string; rate: number; duration: string; sessionDuration?: number; availability?: string }[];
  error?: string;
}

export interface TrainerWorkspace {
  scopeKey: string;
  trainers: ManagedTrainer[];
  canManage: boolean;
  canEditSessions: boolean;
  actorName: string;
  demo: boolean;
  error?: string;
}

export const trainerOverlapError = "Trainer already has a scheduled session during this time. Please choose another available slot.";
export const trainerAvailabilityError = "Trainer is unavailable during this time. Please choose another available slot.";
export const memberScheduleError = "Member tidak tersedia pada waktu tersebut.";
const times = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const openSession = (status: string) => status === "scheduled" || status === "confirmed" || status === "pending_approval";
export const validTrainerSlot = (date: string, start: string, end: string) => isCalendarDate(date) && times.test(start) && times.test(end) && start < end;

function timeOffBounds(item: TrainerTimeOff) {
  return [`${item.date}T${item.startTime || "00:00"}`, `${item.endDate || item.date}T${item.endTime || "24:00"}`] as const;
}

export function validateTrainerAvailability(availability: Availability) {
  if (!availability || !Array.isArray(availability.weekly) || !Array.isArray(availability.timeOff)
      || availability.weekly.length > 70 || availability.timeOff.length > 366) return "Invalid availability.";
  for (const slot of availability.weekly) {
    if (!Number.isInteger(slot.day) || slot.day < 1 || slot.day > 7 || !times.test(slot.start) || !times.test(slot.end)
        || slot.start >= slot.end || !["available", "break"].includes(slot.kind)) return "Enter valid days and time ranges.";
  }
  const overlaps = availability.weekly.some((slot, index) => availability.weekly.slice(index + 1).some(other =>
    slot.day === other.day && slot.kind === other.kind && slot.start < other.end && other.start < slot.end));
  if (overlaps) return "Ranges of the same type cannot overlap on the same day.";
  if (availability.weekly.some(slot => slot.kind === "break" && !availability.weekly.some(working =>
    working.day === slot.day && working.kind === "available" && working.start <= slot.start && working.end >= slot.end))) {
    return "Each break must fit within a working interval.";
  }
  const offRanges: (readonly [string, string])[] = [];
  for (const item of availability.timeOff) {
    const [start, end] = timeOffBounds(item);
    if (!isCalendarDate(item.date) || !isCalendarDate(item.endDate || item.date)
      || (item.startTime && !times.test(item.startTime)) || (item.endTime && !times.test(item.endTime))
      || (item.type && !["leave", "day_off", "unavailable"].includes(item.type))
      || typeof item.reason !== "string" || item.reason.length > 160 || start >= end) {
      return "Enter valid dates, times, and short reasons for time off.";
    }
    if (offRanges.some(([otherStart, otherEnd]) => start < otherEnd && otherStart < end)) {
      return "Enter unique dates and times for overlapping time off.";
    }
    offRanges.push([start, end]);
  }
}

export function trainerAllowsSlot(availability: Availability | null, date: string, start: string, end: string) {
  if (!validTrainerSlot(date, start, end)) return false;
  if (!availability) return true;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  const ranges = availability.weekly.filter(range => range.day === day);
  return !availability.timeOff.some(item => {
    const [offStart, offEnd] = timeOffBounds(item);
    return `${date}T${start}` < offEnd && offStart < `${date}T${end}`;
  })
    && ranges.some(range => range.kind === "available" && range.start <= start && range.end >= end)
    && !ranges.some(range => range.kind === "break" && range.start < end && start < range.end);
}

export function trainerFormValues(data: FormData) {
  const field = (key: string) => String(data.get(key) ?? "").trim();
  const name = field("name"), phone = field("phone"), email = field("email"), gender = field("gender"), bio = field("bio"), certifications = field("certifications");
  const employment = field("employment") as TrainerEmployment, status = field("status") as TrainerStatus;
  const experience = Number(field("experience")), rate = Number(field("rate")), duration = Number(field("duration"));
  const specializations = [...new Set(data.getAll("specializations").map(value => String(value).trim()).filter(Boolean))];
  if (!name || name.length > 100) return { error: "Enter a trainer name up to 100 characters." };
  if (!/^\+?[\d ()-]{7,22}$/.test(phone) || phone.replace(/\D/g, "").length < 7 || phone.replace(/\D/g, "").length > 15)
    return { error: "Enter a valid phone number." };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Enter a valid email address." };
  if (!Number.isInteger(experience) || experience < 0 || experience > 100 || !Number.isFinite(rate) || rate < 0 || rate > 999999999
    || ![30, 45, 60, 90].includes(duration)) return { error: "Check experience, rate, and session duration." };
  if (!["full_time", "part_time", "freelance"].includes(employment) || !["active", "inactive", "on_leave"].includes(status)
    || gender.length > 30 || bio.length > 1000 || certifications.length > 1000 || specializations.length > 15 || specializations.some(item => item.length > 60))
    return { error: "Check trainer profile fields." };
  const photo = data.get("photo");
  if (photo instanceof File && photo.size > 0 && (photo.size > 512 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) {
    return { error: "Use a JPG, PNG, or WebP image up to 512 KB." };
  }
  return { values: { name, phone, email: email || null, gender: gender || null, bio, certifications, employment, status, experience, rate, duration, specializations },
    photo: photo instanceof File && photo.size ? photo : null };
}

export async function isTrainerPhoto(photo: File) {
  const bytes = new Uint8Array(await photo.slice(0, 12).arrayBuffer());
  const startsWith = (prefix: number[]) => prefix.every((value, index) => bytes[index] === value);
  if (photo.type === "image/jpeg") return startsWith([255, 216, 255]);
  if (photo.type === "image/png") return startsWith([137, 80, 78, 71, 13, 10, 26, 10]);
  return photo.type === "image/webp" && startsWith([82, 73, 70, 70]) && bytes.slice(8, 12).join(",") === "87,69,66,80";
}
