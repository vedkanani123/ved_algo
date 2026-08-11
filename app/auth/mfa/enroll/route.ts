import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiError, noStoreJson } from "@/lib/http";

export async function POST() {
  try {
    await requireOwnerApi({ mfa: false });
    const supabase = await createServerSupabase();
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const existing = factors.totp.find((factor) => factor.status === "verified");
    if (existing) return noStoreJson({ factorId: existing.id, qrCode: null, existing: true });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Gann PRO License" });
    if (error) throw error;
    // The QR payload already contains the shared secret needed by an authenticator.
    // Do not also serialize that secret into a JSON response or browser state.
    return noStoreJson({ factorId: data.id, qrCode: data.totp.qr_code, existing: false });
  } catch (error) { return apiError(error); }
}
