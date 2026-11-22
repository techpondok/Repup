import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('./auth.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function setup(values={},failure=null){
 const jar=new Map(Object.entries(values));const calls=[];const exported={};
 const store={get:name=>jar.has(name)?{value:jar.get(name)}:undefined,getAll:()=>[...jar].map(([name,value])=>({name,value})),delete:name=>jar.delete(name)};
 const modules={
  '@/lib/supabase/server':{createClient:async()=>({auth:{signOut:async options=>{calls.push(options);return {error:failure};}}})},
  'next/headers':{cookies:async()=>store},
  'next/navigation':{redirect:path=>{throw new Error(`REDIRECT:${path}`);}},
  '@/lib/demo/roles':{},
 };
 vm.runInNewContext(source,{exports:exported,require:name=>modules[name]});return {signOut:exported.signOut,jar,calls};
}
test('demo logout clears role and tenant cookies then returns to login without an auth service',async()=>{
 const ctx=setup({ru_demo:'1',ru_demo_role:'MEMBER',ru_org_id:'demo-org',ru_branch_id:'demo-branch'});
 await assert.rejects(ctx.signOut(),/REDIRECT:\/login/);assert.equal(ctx.jar.size,0);assert.equal(ctx.calls.length,0);
});
test('real account logout ends only the current device session',async()=>{
 const ctx=setup();await assert.rejects(ctx.signOut(),/REDIRECT:\/login/);assert.equal(ctx.calls.length,1);assert.equal(ctx.calls[0].scope,'local');
});
test('demo plus real or chunked auth cookies also signs out the real session',async()=>{
 for(const name of ['sb-project-auth-token','sb-project-auth-token.0']){
  const ctx=setup({ru_demo:'1',ru_demo_role:'MEMBER',[name]:'fictional-token'});
  await assert.rejects(ctx.signOut(),/REDIRECT:\/login/);assert.equal(ctx.calls.length,1);assert.equal(ctx.calls[0].scope,'local');assert.equal(ctx.jar.has('ru_demo'),false);
 }
});
test('unrelated cookies do not trigger real auth during demo logout',async()=>{
 const ctx=setup({ru_demo:'1',preference:'dark'});await assert.rejects(ctx.signOut(),/REDIRECT:\/login/);assert.equal(ctx.calls.length,0);assert.equal(ctx.jar.get('preference'),'dark');
});
test('auth failure stays retryable and never reports a successful logout',async()=>{
 const ctx=setup({ru_demo:'1','sb-project-auth-token':'fictional-token'},{message:'private service error'});
 await assert.rejects(ctx.signOut(),/^Error: Gagal keluar/);assert.equal(ctx.jar.get('ru_demo'),'1');
});
