import { calendarDayKey } from "./calendar";
import { demoMembers } from "./store/demo-members";
import {
  isTrainerPhoto, memberScheduleError, openSession, trainerAllowsSlot, trainerAvailabilityError, trainerFormValues, trainerOverlapError, validTrainerSlot,
  validateTrainerAvailability, type Availability, type ManagedTrainer, type TrainerDetail, type TrainerSession,
} from "./trainer-management";

type DemoChange = { sessionId: string; previous: TrainerSession; current: TrainerSession; reason: string };
type DemoTrainer = TrainerDetail & { changes?: DemoChange[] };
type DemoResult = { data: DemoTrainer[]; error?: string; conflicts?: number; id?: string };

const schedule: Availability = {
  weekly: [1, 2, 3, 4, 5].flatMap(day => [
    { day, start: "08:00", end: "12:00", kind: "available" as const },
    { day, start: "11:00", end: "11:15", kind: "break" as const },
    { day, start: "14:00", end: "18:00", kind: "available" as const },
  ]),
  timeOff: [],
};

function refreshDemo(detail: DemoTrainer): DemoTrainer {
  const now = Date.now();
  const sessions = [...detail.sessions].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const members = detail.members.map(member => {
    const related = sessions.filter(session => session.memberName === member.name);
    return { ...member, lastSession: related.filter(session => session.status === "completed").at(-1)?.scheduledAt ?? null,
      nextSession: related.find(session => openSession(session.status) && Date.parse(session.scheduledAt) >= now)?.scheduledAt ?? null };
  });
  return { ...detail, sessions, members, trainer: { ...detail.trainer, activeMembers: members.filter(member => member.status === "active").length } };
}

export function createTrainerDemo(now = Date.now()): DemoTrainer[] {
  const today = new Date(`${calendarDayKey(new Date(now))}T00:00:00Z`);
  const weekday = today.getUTCDay();
  today.setUTCDate(today.getUTCDate() + (8 - weekday) % 7 + (weekday === 1 ? 7 : 0));
  const date = today.toISOString().slice(0, 10);
  const records = [
    { name: "Andika Pratama", specializations: ["Strength & Hypertrophy"], experience: 5, rate: 120000, status: "active" },
    { name: "Sarah Putri", specializations: ["Yoga & Pilates", "Weight Loss & Functional Training"], experience: 4, rate: 100000, status: "active" },
    { name: "Rizky Mahendra", specializations: ["Bodybuilding & Strength"], experience: 7, rate: 150000, status: "on_leave" },
  ] as const;
  return records.map((record, index) => {
    const trainer: ManagedTrainer = {
      ...record, specializations: [...record.specializations], id: `demo-trainer-${index + 1}`, code: `TRN-00000${index + 1}`,
      phone: `08120000000${index + 1}`, email: null, gender: null, bio: "", certifications: "",
      employment: index === 2 ? "freelance" : "full_time", duration: 60, activeMembers: 0,
      photo: index === 1 ? "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=160&h=160&fit=crop" : null,
      availability: index === 1 ? { ...schedule, weekly: schedule.weekly.map(range => range.start === "08:00" ? { ...range, start: "07:00" } : range) } : schedule,
    };
    const members = index === 0 ? demoMembers : index === 1 ? demoMembers.slice(1) : [];
    return refreshDemo({
      trainer,
      members: members.map(member => ({ id: member.id, name: member.full_name, photo: null, packageName: null,
        status: "active", lastSession: null, nextSession: null })),
      sessions: members.map((member, memberIndex) => {
        const [start, end] = index === 1 ? ["14:00", "15:00"] : memberIndex === 0 ? ["10:00", "11:00"] : ["09:00", "10:00"];
        return { id: `demo-session-${index + 1}-${memberIndex + 1}`, date, memberName: member.full_name, start, end,
          status: "confirmed", scheduledAt: new Date(`${date}T${start}:00+07:00`).toISOString() };
      }),
    });
  });
}

export async function saveDemoTrainer(data: DemoTrainer[], id: string | null, formData: FormData): Promise<DemoResult> {
  const result = trainerFormValues(formData);
  if (!result.values) return { data, error: result.error };
  let photo = null;
  if (result.photo) {
    if (!(await isTrainerPhoto(result.photo))) return { data, error: "Choose a valid JPG, PNG, or WebP image." };
    const reader = new FileReader();
    photo = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(Error("Could not read trainer photo."));
      reader.readAsDataURL(result.photo!);
    });
  }
  if (id) {
    if (!data.some(detail => detail.trainer.id === id)) return { data, error: "Trainer unavailable." };
    return { id, data: data.map(detail => detail.trainer.id === id ? { ...detail,
      trainer: { ...detail.trainer, ...result.values, photo: photo ?? detail.trainer.photo } } : detail) };
  }
  const nextId = crypto.randomUUID();
  const code = `TRN-${String(data.length + 1).padStart(6, "0")}`;
  return { id: nextId, data: [...data, { trainer: { ...result.values, id: nextId, code, activeMembers: 0, photo,
    availability: { weekly: [], timeOff: [] } }, sessions: [], members: [] }] };
}

export function saveDemoAvailability(data: DemoTrainer[], id: string, availability: Availability): DemoResult {
  const error = validateTrainerAvailability(availability);
  if (error) return { data, error };
  const detail = data.find(record => record.trainer.id === id);
  if (!detail) return { data, error: "Trainer unavailable." };
  const conflicts = detail.sessions.filter(session => openSession(session.status) && Date.parse(session.scheduledAt) >= Date.now()
    && !trainerAllowsSlot(availability, session.date, session.start, session.end)).length;
  return { conflicts, data: data.map(record => record === detail ? { ...record, trainer: { ...record.trainer, availability } } : record) };
}

function changeDemoSession(data: DemoTrainer[], id: string, reason: string, slot?: { date: string; start: string; end: string }): DemoResult {
  const detail = data.find(record => record.sessions.some(session => session.id === id));
  const session = detail?.sessions.find(session => session.id === id);
  if (!detail || !session || !openSession(session.status)) return { data, error: "Only scheduled or confirmed sessions can be changed." };
  if (!reason.trim() || reason.trim().length > 300) return { data, error: "Enter a reason up to 300 characters." };
  let current: TrainerSession = { ...session, status: "cancelled" };
  if (slot) {
    if (!validTrainerSlot(slot.date, slot.start, slot.end)) return { data, error: "Enter a valid date and time range." };
    if ([slot.date, slot.start, slot.end].join() === [session.date, session.start, session.end].join()) return { data, error: "Choose a different schedule." };
    const start = new Date(`${slot.date}T${slot.start}:00+07:00`);
    if (start.getTime() < Date.now()) return { data, error: "Choose a future session time." };
    if (detail.trainer.status !== "active" || !trainerAllowsSlot(detail.trainer.availability, slot.date, slot.start, slot.end)) {
      return { data, error: trainerAvailabilityError };
    }
    if (detail.sessions.some(other => other.id !== id && openSession(other.status) && other.date === slot.date && other.start < slot.end && slot.start < other.end)) {
      return { data, error: trainerOverlapError };
    }
    if (data.some(record => record !== detail && record.sessions.some(other => other.memberName === session.memberName &&
      openSession(other.status) && other.date === slot.date && other.start < slot.end && slot.start < other.end))) return { data, error: memberScheduleError };
    current = { ...session, ...slot, scheduledAt: start.toISOString() };
  }
  return { data: data.map(record => record === detail ? refreshDemo({ ...record,
    sessions: record.sessions.map(item => item.id === id ? current : item),
    changes: [...(record.changes ?? []), { sessionId: id, previous: session, current, reason: reason.trim() }],
  }) : record) };
}

export function rescheduleDemoSession(data: DemoTrainer[], id: string, date: string, start: string, end: string, reason: string) {
  return changeDemoSession(data, id, reason, { date, start, end });
}
export function cancelDemoSession(data: DemoTrainer[], id: string, reason: string) {
  return changeDemoSession(data, id, reason);
}
