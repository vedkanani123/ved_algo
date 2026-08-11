import "server-only";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export type OwnerSession = { id: string; email: string; mfaVerified: boolean };

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== serverEnv().OWNER_EMAIL) return null;

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { id: user.id, email: user.email, mfaVerified: assurance?.currentLevel === "aal2" };
}

export async function requireOwner({ mfa = true }: { mfa?: boolean } = {}) {
  const owner = await getOwnerSession();
  if (!owner) redirect("/login");
  if (mfa && !owner.mfaVerified) redirect("/login?mfa=required");
  return owner;
}

export async function requireOwnerApi({ mfa = true }: { mfa?: boolean } = {}) {
  const owner = await getOwnerSession();
  if (!owner) throw new AuthError(401, "Owner authentication required");
  if (mfa && !owner.mfaVerified) throw new AuthError(403, "MFA verification required");
  return owner;
}

export class AuthError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
