import { z } from "zod";
import { requireOwnerApi } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiError, noStoreJson } from "@/lib/http";

const schema = z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  try {
    await requireOwnerApi({ mfa: false });
    const body = schema.parse(await request.json());
    const supabase = await createServerSupabase();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: body.factorId });
    if (challengeError) throw challengeError;
    const { error } = await supabase.auth.mfa.verify({ factorId: body.factorId, challengeId: challenge.id, code: body.code });
    if (error) throw error;
    return noStoreJson({ ok: true });
  } catch (error) { return apiError(error); }
}
