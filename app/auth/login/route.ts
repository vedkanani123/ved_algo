import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (email !== serverEnv().OWNER_EMAIL || !password) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
