import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hasValidOwnerAccessProof, OWNER_ACCESS_COOKIE } from "@/lib/access-code";
import { serverEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export type OwnerSession = { id: string; email: string; accessCodeVerified: boolean };

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== serverEnv().OWNER_EMAIL) return null;

  const cookieStore = await cookies();
  return { id: user.id, email: user.email, accessCodeVerified: hasValidOwnerAccessProof(user.id, cookieStore.get(OWNER_ACCESS_COOKIE)?.value) };
}

export async function requireOwner({ accessCode = true }: { accessCode?: boolean } = {}) {
  const owner = await getOwnerSession();
  if (!owner) redirect("/login");
  if (accessCode && !owner.accessCodeVerified) redirect("/login?access=required");
  return owner;
}

export async function requireOwnerApi({ accessCode = true }: { accessCode?: boolean } = {}) {
  const owner = await getOwnerSession();
  if (!owner) throw new AuthError(401, "Owner authentication required");
  if (accessCode && !owner.accessCodeVerified) throw new AuthError(403, "Owner access code required");
  return owner;
}

export class AuthError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
