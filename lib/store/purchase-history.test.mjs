import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./purchase-history.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { purchaseAmounts, summarizePurchases } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("Andi's three completed purchases total Rp126.000", () => {
  const purchases = [55000, 35000, 36000].map((total, index) => ({
    ...purchaseAmounts(total, total, total, 0, false),
    date: `2026-11-${10 + index}T03:00:00.000Z`,
  }));
  assert.deepEqual(summarizePurchases(purchases), { total: 126000, count: 3, last: "2026-11-12T03:00:00.000Z" });
});

test("mixed baskets prorate discounts and refunds, avoiding membership spend", () => {
  assert.deepEqual(purchaseAmounts(90000, 100000, 40000, 10000, false), {
    refunded: 10000, status: "Partially Refunded", physicalNet: 32000,
  });
  const refunded = { ...purchaseAmounts(35000, 35000, 35000, 0, true), date: "2026-11-12T03:00:00.000Z" };
  const partial = { ...purchaseAmounts(90000, 100000, 40000, 10000, false), date: "2026-11-11T03:00:00.000Z" };
  assert.deepEqual(summarizePurchases([refunded, partial]), { total: 32000, count: 1, last: refunded.date });
});
