import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  modules.set(url.href, exports);
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const require = name => name.startsWith("@/")
    ? load(new URL(`../../${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith(".") ? load(new URL(`${name}.ts`, url)) : nativeRequire(name);
  runInNewContext(outputText, { exports, require, Date, Intl, process }, { filename: url.pathname });
  return exports;
}

const creation = load(new URL("./class-creation.ts", import.meta.url));
const classes = load(new URL("./classes.ts", import.meta.url));
const { createTrainerDemo } = load(new URL("../trainer-management-demo.ts", import.meta.url));
const now = Date.parse("2026-11-22T03:00:00Z");
const branches = [{ id: "kediri", name: "Kediri" }];
const trainer = {
  trainer: { id: "sarah", status: "active", name: "Sarah Putri", specializations: ["Yoga"], availability: {
    weekly: [1, 3, 5].map(day => ({ day, start: "07:00", end: "18:00", kind: "available" })),
    timeOff: [],
  } },
  sessions: [{ id: "pt-conflict", date: "2026-11-23", start: "09:00", end: "10:00", status: "confirmed" }],
};
const example = {
  ...creation.initialClass("kediri"),
  name: "Morning Yoga", category: "Yoga", trainerId: "sarah", room: "Studio A", date: "2026-11-23", start: "07:00",
};
const validate = (draft = example, existing = [], trainers = [trainer]) => creation.validateClass(draft, trainers, branches, existing, now);
const schedule = (draft = example) => creation.buildClassSessions(draft, validate(draft).slots, trainer, branches[0], "demo-series");
const send = (state, item, type, at = now, args = {}) => classes.classReducer(state, { type, classId: item.id, now: at, eligible: true, ...args });

test("single and recurring sessions use WIB, per-day start times, and distinct attendance IDs", () => {
  const single = validate();
  assert.equal(Object.keys(single.errors).length, 0);
  assert.equal(single.slots[0].startsAt, "2026-11-23T00:00:00.000Z");
  assert.equal(single.slots[0].end, "08:00");
  const draft = { ...example, recurring: true, days: { 1: "07:00", 3: "16:00", 5: "08:00" }, count: 4 };
  const sessions = schedule(draft);
  assert.deepEqual(Array.from(sessions, item => item.startsAt), [
    "2026-11-23T00:00:00.000Z", "2026-11-25T09:00:00.000Z", "2026-11-27T01:00:00.000Z", "2026-11-30T00:00:00.000Z",
  ]);
  assert.equal(new Set(sessions.map(item => item.attendanceId)).size, 4);
  assert.equal(validate({ ...draft, endsBy: "date", endDate: "2026-11-25" }).slots.length, 2);
  assert.match(validate({ ...draft, endsBy: "date", endDate: "2026-11-22" }).errors.endDate, /on or after/);
  assert.match(validate({ ...draft, days: {} }).errors.days, /at least one/);
});

test("save validation rejects conflicting PT, instructor, studio, operating hours and elapsed sessions", () => {
  assert.match(validate({ ...example, start: "09:00" }).errors.schedule, /PT session/);
  assert.match(validate({ ...example, start: "05:30" }).errors.schedule, /Outside gym hours/);
  assert.match(validate({ ...example, date: "2026-11-22" }).errors.schedule, /future/);
  const inactive = { ...trainer, trainer: { ...trainer.trainer, status: "on_leave" } };
  assert.match(validate(example, [], [inactive]).errors.trainerId, /active instructor/);
  assert.match(validate({ ...example, date: "2026-11-24" }).errors.schedule, /unavailable/);
  const existing = schedule()[0];
  assert.match(validate({ ...example, room: "Studio B" }, [existing]).errors.schedule, /Conflicts/);
  assert.match(validate(example, [{ ...existing, trainerId: "another-coach" }]).errors.schedule, /Conflicts/);
  assert.equal(Object.keys(validate({ ...example, start: "08:00" }, [existing]).errors).length, 0);
});

test("drafts are private and published sessions use the shared booking reducer", () => {
  const draft = schedule({ ...example, visibility: "draft" })[0];
  const session = { ...schedule()[0], id: "public-session", capacity: 1 };
  let state = classes.classReducer(classes.createClassState(now), { type: "create", sessions: [draft, session] });
  assert.equal(state.schedules.filter(classes.isPublishedClass).some(item => item.id === draft.id), false);
  assert.equal(send(state, draft, "book").success, false);
  state = send(state, session, "book");
  assert.equal(state.success, true);
  assert.equal(state.schedules.find(item => item.id === session.id).enrolled, 1);
  assert.equal(send(state, session, "book").success, false);
  state = send(state, session, "cancel");
  assert.equal(state.schedules.find(item => item.id === session.id).enrolled, 0);
});

test("applies access, prices, booking windows, waiting list limits and drop-in settings", () => {
  const rules = { ...example.rules, access: "packages", packages: ["monthly"], paid: true, memberPrice: 25000, waitlistLimit: 1, opensMinutes: 1440 };
  const invalid = validate({ ...example, capacity: 1, rules: { ...rules, minimum: 2, memberPrice: -1, opensMinutes: 10, closesMinutes: 15 } }).errors;
  for (const key of ["minimum", "memberPrice", "closesMinutes", "cancellationMinutes"]) assert(invalid[key]);
  const item = schedule({ ...example, rules, capacity: 1 })[0];
  assert.equal(item.rules.memberPrice, 25000);
  const state = classes.classReducer(classes.createClassState(now), { type: "create", sessions: [item] });
  assert.equal(send(state, item, "book", now, { memberPackage: "quarterly" }).success, false);
  assert.equal(send(state, item, "book", now, { memberPackage: "monthly" }).success, true);
  assert.equal(classes.classAvailability(item, Date.parse(item.startsAt) - 30 * 60000), "Booking Closed");
  assert.equal(classes.classAvailability(item, Date.parse(item.startsAt) - 25 * 3600000), "Booking Not Open");
  const full = { ...state, schedules: state.schedules.map(session => session.id === item.id ? { ...session, enrolled: 1 } : session), waitlist: [
    { id: "other-member", classId: item.id, member: false, status: "waiting", joinedAt: new Date(now).toISOString() },
  ] };
  assert.match(send(full, item, "join", now, { memberPackage: "monthly" }).feedback, /waiting list is full/);
  const walkIn = schedule({ ...example, rules: { ...rules, access: "walk-in", walkInPrice: 50000, bookingRequired: false } })[0];
  assert.equal(classes.classEligible(walkIn, false, undefined, true), true);
  assert.equal(walkIn.waitlistEnabled, false);
  assert.equal(walkIn.rules.walkInPrice, 50000);
});

test("a waitlisted walk-in can accept an offer after revisiting the class", () => {
  const full = {
    ...schedule({ ...example, rules: { ...example.rules, access: "walk-in" } })[0],
    enrolled: 15,
  };
  let state = classes.classReducer(classes.createClassState(now), { type: "create", sessions: [full] });
  state = send(state, full, "join", now, { eligible: false, walkIn: true });
  assert.equal(state.waitlist[0].walkIn, true);
  state = send(state, full, "release");
  state = send(state, full, "accept", now + 1000, { eligible: false });
  assert.equal(state.success, true);
  assert.equal(state.bookings.at(-1).walkIn, true);
  assert.equal(state.waitlist.length, 0);
});

test("the Morning Yoga preset fits the seeded instructor and Studio A every weekday", () => {
  const branch = { id: "demo-location-kediri", name: "Kediri" };
  for (let day = 0; day < 7; day++) {
    const time = now + day * 86400000;
    const draft = creation.yogaExample(branch.id, time, "demo-trainer-2");
    const result = creation.validateClass(draft, createTrainerDemo(time), [branch], classes.createClassState(time).schedules, time);
    assert.equal(Object.keys(result.errors).length, 0, JSON.stringify(result.errors));
    assert.equal(result.slots.length, 12);
    assert(Date.parse(result.slots[0].startsAt) < time + 7 * 86400000);
  }
});
