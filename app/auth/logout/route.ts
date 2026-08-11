import { NextResponse } from "next/server";
import { OWNER_ACCESS_COOKIE, ownerAccessCookieOptions } from "@/lib/access-code";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "global" });
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(OWNER_ACCESS_COOKIE, "", { ...ownerAccessCookieOptions, maxAge: 0 });
  return response;
}
