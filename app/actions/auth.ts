"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_ROLES, getDemoRole } from "@/lib/demo/roles";

export type ActionState = { error?: string } | null;

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "Email dan kata sandi wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "Email atau kata sandi salah." };

  redirect("/dashboard");
}

export async function signInDemo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (process.env.APP_DEMO_ENABLED === "false") return { error: "Demo mode sedang dinonaktifkan." };
  const role = getDemoRole(String(formData.get("role") || "OWNER"));
  const cookieStore = await cookies();
  cookieStore.set("ru_demo", "1", { path: "/", httpOnly: true, sameSite: "lax" });
  cookieStore.set("ru_demo_role", role, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect(role === "MEMBER" ? "/member/dashboard" : DEMO_ROLES[role].scope === "platform" ? "/platform" : "/dashboard");
}

export async function switchDemoRole(formData: FormData) {
  const cookieStore = await cookies();
  if (cookieStore.get("ru_demo")?.value !== "1") redirect("/login");
  const role = getDemoRole(String(formData.get("role") || "OWNER"));
  if (DEMO_ROLES[role].scope !== "organization") redirect("/dashboard");
  cookieStore.set("ru_demo_role", role, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect(role === "MEMBER" ? "/member/dashboard" : "/dashboard");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");

  if (!fullName || !email || !password) return { error: "Semua kolom wajib diisi." };
  if (password.length < 8) return { error: "Kata sandi minimal 8 karakter." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Email ini sudah terdaftar. Silakan masuk." };
    }
    return { error: error.message };
  }

  redirect("/onboarding");
}

export async function signOut() {
  const cookieStore = await cookies();
  const isDemo = cookieStore.get("ru_demo")?.value === "1";
  const hasAuthCookie = cookieStore.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
  // A demo cookie can coexist with a real login. End this device's session too.
  if (!isDemo || hasAuthCookie) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("Gagal keluar. Coba lagi.");
  }
  for (const name of ["ru_demo", "ru_demo_role", "ru_org_id", "ru_branch_id"]) cookieStore.delete(name);
  redirect("/login");
}

export async function resetDemo() {
  const cookieStore = await cookies();
  cookieStore.delete("ru_demo");
  cookieStore.delete("ru_demo_role");
  redirect("/demo");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Masukkan email Anda." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`,
  });

  // Always show success (avoid leaking which emails are registered).
  return { error: undefined };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Kata sandi minimal 8 karakter." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
