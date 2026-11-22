import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest, NextResponse } from "next/server.js";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("./middleware.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(env = {}, getUser = async () => ({ data: { user: null } })) {
  let calls = 0;
  const exports = {};
  const modules = {
    "next/server": { NextResponse },
    "@/lib/auth-mode": {
      liveAuthEnabled: () => env.APP_LIVE_AUTH_ENABLED === "true",
      isAuthCookie: name => /^sb-.+-auth-token(?:\.\d+)?$/.test(name),
    },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => {
      calls++;
      return { auth: { getUser: () => getUser(options) } };
    } },
  };
  runInNewContext(source, { exports, process: { env }, require: name => modules[name], console: { error() {} } });
  return {
    request: (path, cookie = "") => exports.updateSession(new NextRequest(`https://repup.example${path}`, { headers: { cookie } })),
    calls: () => calls,
  };
}

test("offline login is public and dashboard fails closed even with a stale live cookie", async () => {
  const ctx = setup();
  assert.equal((await ctx.request("/login", "sb-project-auth-token.0=old")).status, 200);
  const response = await ctx.request("/dashboard?private=1", "sb-project-auth-token.0=old");
  assert.equal(response.headers.get("location"), "https://repup.example/login");
  assert.equal(ctx.calls(), 0);
});

test("only the explicit mock mode is available without live authentication", async () => {
  const demoCookie = "ru_demo=1";
  assert.equal((await setup().request("/dashboard", demoCookie)).status, 200);
  assert.equal((await setup({ APP_DEMO_ENABLED: "false" }).request("/dashboard", demoCookie)).status, 307);
  assert.equal((await setup().request("/login-private")).status, 307);
});

test("live mode remains fail closed on missing config and auth exceptions", async () => {
  const flags = { APP_LIVE_AUTH_ENABLED: "true" };
  const cookie = "sb-project-auth-token=invalid";
  assert.equal((await setup(flags).request("/login", cookie)).status, 200);
  assert.equal((await setup(flags).request("/dashboard", cookie)).status, 307);
  const ctx = setup({ ...flags, NEXT_PUBLIC_SUPABASE_URL: "https://project.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock" }, async () => { throw new Error("unavailable"); });
  assert.equal((await ctx.request("/login", cookie)).status, 200);
  assert.equal((await ctx.request("/dashboard", cookie)).status, 307);
});

test("valid live sessions redirect from login and retain refreshed cookies", async () => {
  const ctx = setup({
    APP_LIVE_AUTH_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://project.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock",
  }, async ({ cookies }) => {
    cookies.setAll([{ name: "sb-project-auth-token", value: "refreshed", options: { path: "/" } }], {});
    return { data: { user: { id: "verified" } } };
  });
  const response = await ctx.request("/login", "sb-project-auth-token=old");
  assert.equal(response.headers.get("location"), "https://repup.example/dashboard");
  assert.match(response.headers.get("set-cookie"), /sb-project-auth-token=refreshed/);
});
