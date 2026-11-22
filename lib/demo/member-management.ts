import { demoMembers } from "@/lib/store/demo-members";

export const packages = [
  { id: "monthly", name: "Monthly Access", days: 30, price: 350000 },
  { id: "quarterly", name: "Quarterly Access", days: 90, price: 950000 },
  { id: "annual", name: "Annual Access", days: 365, price: 3200000 },
];
export const plans = {
  Free: { limit: 50, features: "1 location · 2 staff accounts" },
  Growth: { limit: 300, features: "Advanced Analytics · Additional Staff" },
};
export const followStatuses = ["Not Contacted", "Contacted", "Interested", "Will Renew", "Renewed", "Not Interested", "No Response"];
export const payments = ["Cash", "QRIS", "Bank Transfer"];
const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" });
export const day = () => dayFormat.format(new Date());
export function addDays(date: string, count: number) {
  return new Date(Date.parse(date) + count * 86400000).toISOString().slice(0, 10);
}
export function daysLeft(end: string, today: string) {
  return Math.round((Date.parse(end) - Date.parse(today)) / 86400000);
}
export const packageFor = (id?: string) => packages.find(plan => plan.id === id);
export type Membership = { id: string; packageId: string; start: string; end: string; price: number; method: string; frozen: boolean; supersededOn?: string };
export type Profile = { name: string; phone: string; email: string; birth: string; gender: string; address: string; emergency: string; photo: string };
export type Activity = { id: string; type: string; description: string; at: string };
export type Visit = { id: string; at: string; out?: string };
export type FollowUp = { staff: string; method: string; date: string; notes: string; next: string; status: string };
export type PtBooking = { id: string; at: string; createdAt: string; status: "Reserved" | "Completed" | "Cancelled" };
export type Member = Profile & {
  id: string;
  branchId: string;
  joined: string;
  memberships: Membership[];
  visits: Visit[];
  followUps: FollowUp[];
  activities: Activity[];
  pt?: { trainerId: string; packageId: string; bookings: PtBooking[] };
};
export function current(member: Member, today = day()) {
  return member.memberships.find(item => item.start <= today && item.end >= today && (!item.supersededOn || item.supersededOn > today))
    ?? member.memberships.find(item => item.start > today && (!item.supersededOn || item.supersededOn > item.start))
    ?? member.memberships[0];
}
export function status(member: Member, today: string) {
  const membership = current(member, today);
  if (!membership) return "No Membership";
  const remaining = daysLeft(membership.end, today);
  if (remaining < 0) return "Expired";
  if (membership.frozen) return "Frozen";
  if (membership.start > today) return "Scheduled";
  return remaining <= 7 ? "Expiring Soon" : "Active";
}
export function activeCount(members: Member[], today: string) {
  return members.filter(member => {
    const membership = current(member, today);
    const scheduled = member.memberships.some(item => item.start > today && !item.frozen
      && (!item.supersededOn || item.supersededOn > item.start));
    return scheduled || Boolean(membership && !membership.frozen && membership.end >= today);
  }).length;
}
export const blankProfile: Profile = { name: "", phone: "", email: "", birth: "", gender: "", address: "", emergency: "", photo: "" };
export function profileError(profile: Profile) {
  if (profile.name.trim().length < 2) return "Enter a full name with at least 2 characters.";
  if (!/^\+?[0-9 ().-]{8,22}$/.test(profile.phone) || profile.phone.replace(/\D/g, "").length < 8) return "Enter a valid phone number.";
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return "Enter a valid email address.";
  return "";
}
export function activity(member: Member, type: string, description: string, at = new Date().toISOString()): Member {
  return { ...member, activities: [{ id: `${type}-${at}-${member.activities.length}`, type, description, at }, ...member.activities] };
}
export function newMember(profile: Profile, id: string, branchId: string, today: string, membership?: Membership): Member {
  const member = activity({ ...profile, id, branchId, joined: today, memberships: membership ? [membership] : [], visits: [], followUps: [], activities: [] }, "Member Created", profile.name);
  return membership ? activity(member, "Membership Purchased", packageFor(membership.packageId)!.name) : member;
}
export function seedMembers(today: string): Member[] {
  const samples = ["Budi Santoso", "Rina Pratiwi", "Dimas Putra", "Nadia Aulia", "Fajar Ramadhan", "Dewi Anggraini", "Rizky Hidayat", "Ayu Permata", "Bagas Saputra", "Intan Maharani", "Yusuf Akbar", "Fitri Lestari", "Arif Setiawan", "Nisa Amalia"];
  const records = [...demoMembers, ...samples.map((full_name, index) => ({
    id: `RPU-${String(index + 125).padStart(6, "0")}`, full_name,
    branchId: index >= 11 ? "demo-location-surabaya" : "demo-location-kediri",
    phone: `081290100${String(index).padStart(3, "0")}`,
  }))];
  return records.map((record, index) => {
    const plan = packages[index % packages.length];
    const end = addDays(today, [5, 0, -4, 14, 23, -2, 4, 11][index % 8]);
    const start = addDays(end, 1 - plan.days);
    const joined = addDays(today, -400 - index);
    const visitDay = addDays(today, Math.min(-1 - index % 9, daysLeft(end, today)));
    const visit = { id: `visit-${index}`, at: `${visitDay}T08:30:00+07:00`, out: `${visitDay}T09:45:00+07:00` };
    const member: Member = {
      ...blankProfile, id: record.id, name: record.full_name, phone: record.phone, branchId: record.branchId, joined,
      email: `${record.full_name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      memberships: index === 9 ? [] : [{ id: `seed-${index}`, packageId: plan.id, start, end, price: plan.price, method: payments[index % payments.length], frozen: index === 7 }],
      visits: index === 9 ? [] : [visit], followUps: [], activities: [],
      photo: ["https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=faces", "https://images.unsplash.com/photo-1534528741775-53994a69da69?w=160&h=160&fit=crop&crop=faces"][index] ?? "",
      pt: index < 2 ? {
        trainerId: "bima", packageId: "progress",
        bookings: [
          { id: "PT-04", at: `${addDays(today, 3 + index)}T17:00:00+07:00`, createdAt: `${addDays(today, -1)}T12:00:00+07:00`, status: "Reserved" },
          ...[7, 5, 3].map((offset, entry) => {
            const at = `${addDays(today, -offset)}T17:00:00+07:00`;
            return { id: `PT-0${entry + 1}`, at, createdAt: at, status: "Completed" as const };
          }),
        ],
      } : undefined,
    };
    const created = activity(member, "Member Created", member.name, `${joined}T09:00:00+07:00`);
    if (!current(member, today)) return created;
    return activity(activity(created, "Membership Purchased", plan.name, `${start}T09:00:00+07:00`), "Check-in", "Front desk check-in", visit.at);
  });
}

export const csvFields = ["name", "phone", "email", "birth", "gender", "address", "emergency"] as const;
export const csvLabels = ["Full Name", "Phone Number", "Email", "Date of Birth", "Gender", "Address", "Emergency Contact"];
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let index = 0; index <= text.length; index++) {
    const char = text[index] ?? "\n";
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === "," || char === "\n") {
      row.push(cell);
      cell = "";
      closed = false;
      if (char === "\n") {
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === '"' || closed) throw new Error("Invalid CSV quoting.");
    else cell += char;
  }
  if (quoted) throw new Error("An opening quote is missing its closing quote.");
  if (rows.length < 2) throw new Error("Include a header and at least one data row.");
  return rows;
}
export const phoneKey = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits.replace(/^0/, "62");
};
export function exportCsv(members: Member[], today: string) {
  const rows = [
    ["Member ID", ...csvLabels, "Membership Package", "Expiration Date", "Last Visit", "Status"],
    ...members.map(member => [member.id, ...csvFields.map(field => member[field]), packageFor(current(member, today)?.packageId)?.name ?? "", current(member, today)?.end ?? "", member.visits[0]?.at ?? "", status(member, today)]),
  ];
  return rows.map(row => row.map(cell => `"${cell.replace(/^[\s]*[=+@-]/, match => "'" + match).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
