import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('./calendar.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exported,Intl,Date});
const {isCalendarDate,calendarDayKey,calendarMonthCells,shiftCalendarMonth}=exported;
test('calendar validates real dates and leap-year boundaries',()=>{
 assert.equal(isCalendarDate('2028-02-29'),true);assert.equal(isCalendarDate('2026-02-29'),false);assert.equal(isCalendarDate('2026-13-01'),false);assert.equal(isCalendarDate('invalid'),false);
});
test('calendar uses WIB day and keeps date-only values stable',()=>{
 assert.equal(calendarDayKey('2026-11-18T18:00:00Z'),'2026-11-19');assert.equal(calendarDayKey('2026-11-18'),'2026-11-18');
});
test('month navigation crosses years and never overflows month-end',()=>{
 assert.equal(shiftCalendarMonth('2026-12-31',1),'2027-01-01');assert.equal(shiftCalendarMonth('2026-01-31',-1),'2025-12-01');assert.equal(shiftCalendarMonth('2028-01-31',1),'2028-02-01');
});
test('calendar grid starts Monday, includes all month dates once and includes adjacent month cells',()=>{
 const cells=calendarMonthCells('2026-11-18');assert.equal(cells.length,42);assert.equal(new Date(cells[0].date+'T00:00:00Z').getUTCDay(),1);
 assert.equal(cells.filter(c=>c.inMonth).length,30);assert.equal(new Set(cells.map(c=>c.date)).size,42);assert.equal(cells.find(c=>c.date==='2026-11-01').inMonth,true);assert.equal(cells.find(c=>c.date==='2026-10-31').inMonth,false);
 assert.equal(calendarMonthCells('2028-02-01').filter(c=>c.inMonth).length,29);
});
