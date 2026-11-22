import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../../app/(app)/check-in/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function setup({ demo = false, permitted = true, historyFails = false } = {}) {
  const exports = {};
  const calls = [];
  const branch = { id: "test-branch", name: "Kediri" };
  const modules = {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@/lib/tenant": { getTenantContext: async () => ({ isDemo: demo, demoRole: "OWNER", branch, organization: { id: "test-org" } }) },
    "@/lib/demo/roles": { hasDemoPermission: () => permitted },
    "@/lib/authorization": { requirePermission: async () => { calls.push("permission"); if (!permitted) throw new Error("forbidden"); } },
    "@/components/ui/layout-bits": { PageHeader: "PageHeader", EmptyState: "EmptyState" },
    "@/components/checkin/checkin-terminal": { CheckinTerminal: "LiveTerminal" },
    "@/components/checkin/demo-checkin-terminal": { DemoCheckinTerminal: "DemoTerminal" },
    "@/app/actions/checkin": {
      getRecentAttendance: async () => { calls.push("history"); if (historyFails) throw new Error("unavailable"); return [{ id: "recent" }]; },
      getActiveVisits: async () => { calls.push("active"); return [{ id: "active" }]; },
    },
  };
  runInNewContext(source, { exports, require: name => modules[name] });
  return { render: exports.default, calls };
}

test("demo Check-in renders without invoking live permission or attendance services", async () => {
  const ctx = setup({ demo: true, historyFails: true });
  const page = await ctx.render();
  assert.equal(page.props.children[1].type, "DemoTerminal");
  assert.deepEqual(ctx.calls, []);
});

test("failed live history does not hide the terminal or successful active visitors", async () => {
  const ctx = setup({ historyFails: true });
  const terminal = (await ctx.render()).props.children[1];
  assert.equal(terminal.type, "LiveTerminal");
  assert.equal(terminal.props.historyUnavailable, true);
  assert.equal(terminal.props.activeUnavailable, false);
  assert.equal(terminal.props.initialActive[0].id, "active");
  assert.deepEqual(ctx.calls, ["permission", "history", "active"]);
});

test("a forbidden live user cannot trigger either attendance read", async () => {
  const ctx = setup({ permitted: false });
  await assert.rejects(ctx.render(), /forbidden/);
  assert.deepEqual(ctx.calls, ["permission"]);
});
