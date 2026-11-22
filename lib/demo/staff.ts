export const staffRoles = ["Receptionist", "Cashier", "Gym Staff", "Branch Manager", "Admin"] as const;
export const employmentTypes = ["full_time", "part_time", "freelance"] as const;
export type DemoStaff = {
  id: string;
  code: string;
  name: string;
  email: string;
  position: (typeof staffRoles)[number];
  employment: (typeof employmentTypes)[number];
  branch: string;
  weekdays: number[];
};

export const demoStaff: DemoStaff[] = [
  { id: "demo-payroll-receptionist", code: "EMP-001", name: "Budi Santoso", email: "budi@example.test", position: "Receptionist", employment: "full_time", branch: "demo-location-kediri", weekdays: [1, 2, 3, 4, 5] },
  { id: "demo-payroll-cashier", code: "EMP-002", name: "Aulia Permata", email: "aulia@example.test", position: "Cashier", employment: "full_time", branch: "demo-location-kediri", weekdays: [1, 2, 3, 4, 5] },
  { id: "demo-payroll-staff", code: "EMP-003", name: "Farhan Aditya", email: "farhan@example.test", position: "Gym Staff", employment: "full_time", branch: "demo-location-surabaya", weekdays: [2, 3, 4, 5, 6] },
  { id: "demo-staff-manager", code: "EMP-004", name: "Nadia Pratama", email: "nadia@example.test", position: "Branch Manager", employment: "full_time", branch: "demo-location-surabaya", weekdays: [1, 2, 3, 4, 5] },
];
