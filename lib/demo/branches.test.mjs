import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("./branches.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const branches = {};
runInNewContext(outputText, { exports: branches });

test("Starter charges one base subscription and a fee per extra active branch", () => {
  for (const [count, expected] of [[1, 99_000], [2, 178_000], [3, 257_000], [5, 415_000]]) {
    const cost = branches.branchCost("Starter", count);
    assert.equal(cost.monthly, expected);
    assert.equal(cost.yearly, expected * 12);
    assert.equal(cost.allowed, true);
  }
});

test("Free blocks a second active branch", () => {
  assert.equal(branches.branchCost("Free", 1).allowed, true);
  assert.equal(branches.branchCost("Free", 1).monthly, 0);
  assert.equal(branches.branchCost("Free", 2).allowed, false);
});

test("branch edits preserve unique codes and validate operating hours", () => {
  const [existing] = branches.demoBranches;
  assert.equal(branches.branchError(existing, branches.demoBranches), undefined);
  assert.match(branches.branchError({ ...existing, id: "" }, branches.demoBranches), /already in use/i);
  assert.match(branches.branchError({ ...existing, closes: existing.opens }, branches.demoBranches), /hours/i);
  assert.match(branches.branchError({ ...existing, email: "invalid" }, branches.demoBranches), /email/i);
});
