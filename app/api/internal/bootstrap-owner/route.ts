import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(12).max(128) });

export async function POST(request: Request) {
  const token = request.headers.get("x-bootstrap-token");
  const expected = process.env.OWNER_BOOTSTRAP_TOKEN;
  if (!token || !expected || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { password } = schema.parse(await request.json());
  const admin = createAdminClient();
  const email = serverEnv().OWNER_EMAIL;
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  const existing = users.users.find((user) => user.email?.toLowerCase() === email);
  const { error } = existing
    ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
