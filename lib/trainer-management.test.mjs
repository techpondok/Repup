import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(file, imports = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  runInNewContext(outputText, { exports, File, require: name => imports[name] });
  return exports;
}

const { trainerAllowsSlot, validateTrainerAvailability, validTrainerSlot, trainerFormValues } = load("./trainer-management.ts", {
  "./calendar": load("./calendar.ts"),
});
const availability = {
  weekly: [
    { day: 1, kind: "available", start: "08:00", end: "12:00" },
    { day: 1, kind: "break", start: "11:00", end: "11:30" },
    { day: 1, kind: "available", start: "14:00", end: "18:00" },
  ],
  timeOff: [{ date: "2030-06-10", reason: "Leave" }],
};

test("weekly slots honor breaks, gaps, time off, and adjacent boundaries", () => {
  assert.equal(validateTrainerAvailability(availability), undefined);
  assert.equal(trainerAllowsSlot(availability, "2030-06-03", "10:00", "11:00"), true);
  assert.equal(trainerAllowsSlot(availability, "2030-06-03", "11:30", "12:00"), true);
  assert.equal(trainerAllowsSlot(availability, "2030-06-03", "10:30", "11:30"), false);
  assert.equal(trainerAllowsSlot(availability, "2030-06-03", "12:00", "13:00"), false);
  assert.equal(trainerAllowsSlot(availability, "2030-06-03", "14:00", "15:00"), true);
  assert.equal(trainerAllowsSlot(availability, "2030-06-10", "14:00", "15:00"), false);
  assert.equal(validTrainerSlot("2030-02-30", "10:00", "11:00"), false);
});

test("availability rejects overlapping ranges and duplicate time-off dates", () => {
  assert.match(validateTrainerAvailability({
    ...availability, weekly: [...availability.weekly, { day: 1, kind: "available", start: "10:00", end: "13:00" }],
  }), /cannot overlap/);
  assert.match(validateTrainerAvailability({ ...availability, timeOff: [...availability.timeOff, ...availability.timeOff] }), /unique dates/);
});

test("trainer profile validates contact, numeric values, and photo type", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Andika", phone: "+628123456789", status: "active", employment: "full_time", experience: "5", rate: "120000", duration: "60" })) {
    form.set(key, value);
  }
  assert.equal(trainerFormValues(form).values.rate, 120000);
  form.set("email", "not-an-email");
  assert.match(trainerFormValues(form).error, /email/);
  form.delete("email");
  form.set("rate", "-1");
  assert.match(trainerFormValues(form).error, /rate/);
  form.set("rate", "0");
  form.set("photo", new File(["fake"], "trainer.svg", { type: "image/svg+xml" }));
  assert.match(trainerFormValues(form).error, /JPG/);
});
