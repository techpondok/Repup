import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const exported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('./pt.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exported,Intl,Date,process:{env:{NODE_ENV:'development'}}});
const {createPTState,ptTransition,remainingPT,ptBookingError}=exported;
const now=Date.parse('2026-11-18T08:00:00+07:00');
function active(){return ptTransition(createPTState(),{type:'purchase',packageId:'starter',trainerId:'bima',now}).state;}
const book=(state,startsAt='2026-11-20T09:00:00+07:00',extra={})=>ptTransition(state,{type:'book',packageId:state.packages[0].id,startsAt,membershipActive:true,now,...extra});
test('purchase, booking reservation, duplicate rejection and cancellation release',()=>{const state=active();assert.equal(remainingPT(state,state.packages[0]),4);const reserved=book(state).state;assert.equal(remainingPT(reserved,reserved.packages[0]),3);assert.match(book(reserved).error,/overlaps/);const cancelled=ptTransition(reserved,{type:'cancel',id:reserved.sessions[0].id,now}).state;assert.equal(remainingPT(cancelled,cancelled.packages[0]),4);assert.equal(cancelled.sessions[0].status,'cancelled');});
test('reschedule keeps reference and reserves only one credit',()=>{const booked=book(active()).state;const updated=book(booked,'2026-11-21T14:00:00+07:00',{rescheduleId:booked.sessions[0].id}).state;assert.equal(updated.sessions.length,1);assert.equal(updated.sessions[0].id,booked.sessions[0].id);assert.equal(remainingPT(updated,updated.packages[0]),3);});
test('membership expiry, unavailable slots, past dates and cutoff enforced',()=>{const state=active();assert.match(book(state,'2026-11-20T09:00:00+07:00',{membershipActive:false}).error,/membership/);assert.match(book(state,'2026-11-20T09:00:00+07:00',{membershipExpiresAt:'2026-11-19T23:59:00+07:00'}).error,/Renew/);assert.match(book(state,'2026-11-20T11:00:00+07:00').error,/unavailable/);assert.match(book(state,'2026-11-17T09:00:00+07:00').error,/future/);const booked=book(state).state;assert.match(ptTransition(booked,{type:'cancel',id:booked.sessions[0].id,now:Date.parse('2026-11-20T08:00:00+07:00')}).error,/2 hours/);});
test('trainer assignment and quota boundaries',()=>{const state=active();const assigned=ptTransition(state,{type:'trainer',trainerId:'maya',now}).state;assert.equal(assigned.packages[0].trainerId,'maya');const exhausted={...state,packages:[{...state.packages[0],completed:4}]};assert.match(book(exhausted).error,/used or reserved/);const unassigned={...state,packages:[{...state.packages[0],trainerId:null}]};assert.match(book(unassigned).error,/Choose a trainer/);const expired={...state,packages:[{...state.packages[0],expiresAt:new Date(now-1).toISOString()}]};assert.match(ptBookingError(expired,expired.packages[0].id,'2026-11-20T09:00:00+07:00',true,undefined,now),/expired/);});

const attendanceNow=Date.parse('2026-11-20T09:05:00+07:00');
const tokenA='pt-demo:11111111-1111-4111-8111-111111111111';
const tokenB='pt-demo:22222222-2222-4222-8222-222222222222';
function attendanceFixture(){const state=book(active()).state;return ptTransition(state,{type:'issue-qr',id:state.sessions[0].id,token:tokenA,now:attendanceNow}).state;}
function scan(state,extra={}){return ptTransition(state,{type:'scan',id:state.sessions[0].id,token:tokenA,trainerId:'bima',branch:'Sudirman',role:'TRAINER',now:attendanceNow,...extra});}
function finish(state,extra={}){return ptTransition(state,{type:'complete',id:state.sessions[0].id,trainerId:'bima',branch:'Sudirman',role:'TRAINER',now:attendanceNow,...extra});}
test('QR issue and scan never complete or consume a credit; completion consumes exactly once',()=>{
 const issued=attendanceFixture();assert.equal(issued.packages[0].completed,0);assert.equal(issued.sessions[0].attendance,undefined);
 const verified=scan(issued);assert.equal(verified.error,undefined);assert.equal(verified.state.sessions[0].status,'upcoming');assert.equal(verified.state.sessions[0].attendance.verifiedAt,new Date(attendanceNow).toISOString());assert.equal(verified.state.packages[0].completed,0);assert.equal(remainingPT(verified.state,verified.state.packages[0]),3);
 assert.match(scan(verified.state).error,/Duplicate/);assert.equal(verified.state.attendanceTokens[verified.state.sessions[0].id],undefined);
 const completed=finish(verified.state);assert.equal(completed.error,undefined);assert.equal(completed.state.sessions[0].status,'completed');assert.equal(completed.state.packages[0].completed,1);assert.equal(remainingPT(completed.state,completed.state.packages[0]),3);assert.match(finish(completed.state).error,/no longer active/);
});
test('trainer scan rejects member role, wrong trainer, branch, session, Gym QR and expired tokens without mutation',()=>{
 const state=attendanceFixture();
 for(const [extra,message] of [[{role:'MEMBER'},/access/],[{trainerId:'maya'},/assigned/],[{branch:'Kemang'},/branch/],[{id:'missing'},/not found/],[{token:'repup-demo-only:gym'},/Invalid QR/],[{now:attendanceNow+30000},/expired/],[{now:Date.parse('2026-11-20T08:00:00+07:00')},/time window/]]){const result=scan(state,extra);assert.match(result.error,message);assert.equal(result.state,state);}
 assert.match(finish(state).error,/Verify attendance/);
});
test('rotation invalidates previous token and binds QR to exactly one session',()=>{
 const state=attendanceFixture();const session=state.sessions[0];const rotated=ptTransition(state,{type:'issue-qr',id:session.id,token:tokenB,now:attendanceNow+1000}).state;
 assert.match(scan(rotated).error,/Invalid QR/);assert.equal(scan(rotated,{token:tokenB,now:attendanceNow+1000}).error,undefined);
 const other={...rotated,sessions:[...rotated.sessions,{...session,id:'other'}]};assert.match(scan(other,{id:'other',token:tokenB}).error,/Invalid QR/);
});
test('availability boundaries and terminal states never issue QR',()=>{
 const state=book(active()).state;const session=state.sessions[0];const start=Date.parse(session.startsAt);
 assert.match(ptTransition(state,{type:'issue-qr',id:session.id,token:tokenA,now:start-900001}).error,/15 minutes/);
 assert.equal(ptTransition(state,{type:'issue-qr',id:session.id,token:tokenA,now:start-900000}).error,undefined);
 assert.match(ptTransition(state,{type:'issue-qr',id:session.id,token:tokenA,now:start+3600001}).error,/15 minutes/);
 for(const status of ['completed','cancelled','no-show'])assert.match(ptTransition({...state,sessions:[{...session,status}]},{type:'issue-qr',id:session.id,token:tokenA,now:start}).error,/no longer active/);
});
test('no-show charges only explicit mock policy after session ends and never duplicates',()=>{
 const state=attendanceFixture();const action={type:'no-show',id:state.sessions[0].id,trainerId:'bima',branch:'Sudirman',role:'TRAINER',now:Date.parse('2026-11-20T10:01:00+07:00')};
 assert.match(ptTransition(state,{...action,now:attendanceNow}).error,/only after/);
 const free=ptTransition(state,action);assert.equal(free.state.packages[0].completed,0);assert.equal(free.state.packages[0].penalized,0);assert.equal(remainingPT(free.state,free.state.packages[0]),4);
 const charged=ptTransition(state,{...action,chargePenalty:true});assert.equal(charged.state.packages[0].penalized,1);assert.equal(remainingPT(charged.state,charged.state.packages[0]),3);assert.match(ptTransition(charged.state,action).error,/no longer active/);
 assert.match(ptTransition(scan(state).state,action).error,/unverified/);
});
test('verified sessions cannot cancel, reschedule, regenerate QR or change trainer',()=>{
 const state=scan(attendanceFixture()).state;const session=state.sessions[0];
 assert.match(ptTransition(state,{type:'cancel',id:session.id,now:attendanceNow}).error,/Verified/);
 assert.match(book(state,'2026-11-21T14:00:00+07:00',{rescheduleId:session.id,now:Date.parse('2026-11-20T06:00:00+07:00')}).error,/Verified/);
 assert.match(ptTransition(state,{type:'issue-qr',id:session.id,token:tokenB,now:attendanceNow}).error,/already verified/);
 assert.match(ptTransition(state,{type:'trainer',trainerId:'maya',now:attendanceNow}).error,/Cancel upcoming/);
});
test('attendance labels cover all requested states',()=>{
 const state=attendanceFixture();const session=state.sessions[0];const label=exported.ptAttendanceLabel;
 assert.equal(label(state,session,Date.parse('2026-11-20T08:00:00+07:00')),'Not Yet Available');assert.equal(label(state,session,attendanceNow),'Ready to Scan');assert.equal(label(state,session,attendanceNow+30000),'Expired');
 const verified=scan(state).state;assert.equal(label(verified,verified.sessions[0],attendanceNow),'Attendance Verified');
 for(const [status,expected] of [['completed','Completed'],['cancelled','Cancelled'],['no-show','No Show']])assert.equal(label(state,{...session,status},attendanceNow),expected);
});
