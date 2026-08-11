import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiError, noStoreJson } from "@/lib/http";

export async function POST() {
  try {
    await requireOwnerApi({ mfa: false });
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Gann PRO License" });
    if (error) throw error;
    return noStoreJson({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  } catch (error) { return apiError(error); }
}
