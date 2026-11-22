export const branchPricing = {
  Free: { base: 0, included: 1, extra: 0, max: 1, memberLimit: 50, staffLimit: 2 },
  Starter: { base: 99000, included: 1, extra: 79000, max: Infinity, memberLimit: null, staffLimit: null },
} as const;
export type Plan = keyof typeof branchPricing;
export const facilities = ["Weight Training Area", "Cardio Area", "Class Studio", "Personal Training Area", "Locker Room", "Shower", "Parking"];
export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export type Branch = {
  id: string; name: string; code: string; phone: string; email: string; address: string; city: string; province: string;
  postal: string; manager: string; status: "active" | "inactive"; opens: string; closes: string;
  days: string[]; timezone: string; capacity: number; facilities: string[];
};
export const blankBranch: Branch = { id: "", name: "", code: "", phone: "", email: "", address: "", city: "", province: "", postal: "",
  manager: "", status: "active", opens: "06:00", closes: "22:00", days, timezone: "Asia/Jakarta", capacity: 60, facilities: [] };
export const demoBranches: Branch[] = ["Kediri", "Surabaya", "Malang"].map(name => ({
  ...blankBranch, id: "demo-location-" + name.toLowerCase(), code: name.slice(0, 3).toUpperCase(), name, city: name, province: "Jawa Timur", facilities: facilities.slice(0, 3),
  manager: name === "Surabaya" ? "demo-staff-manager" : "",
}));

export function trainerBranchIds(id: string, assigned?: string[]) {
  const index = ["demo-trainer-1", "demo-trainer-2", "demo-trainer-3"].indexOf(id);
  return assigned?.length ? assigned : index < 0 ? [] : [demoBranches[index].id];
}

export function branchCost(plan: Plan, count: number) {
  const pricing = branchPricing[plan];
  const extraCount = Math.max(0, count - pricing.included);
  const fees = extraCount * pricing.extra;
  const monthly = pricing.base + fees;
  return { ...pricing, extraCount, fees, monthly, yearly: monthly * 12, allowed: count <= pricing.max };
}

export function branchError(value: Branch, rows: Branch[]) {
  if (!value.name.trim() || !/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(value.code)) return "Enter a branch name and a unique 2–16 character code.";
  if (rows.some(row => row.id !== value.id && row.code === value.code)) return "This branch code is already in use.";
  if (value.phone && !/^\+?[\d ()-]{7,20}$/.test(value.phone)) return "Enter a valid phone number.";
  if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) return "Enter a valid email.";
  if (!value.opens || !value.closes || value.opens >= value.closes || !value.days.length) return "Review operating hours and days.";
  if (!Number.isInteger(value.capacity) || value.capacity < 1) return "Capacity must be at least one.";
}
