import { z } from "zod";
import { fingerprint } from "@/lib/licenses";
import { createAdminClient } from "@/lib/supabase/admin";
import { noStoreJson } from "@/lib/http";
import { withinRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  accountNumber: z.coerce.number().int().nonnegative(),
  deviceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  eaVersion: z.string().min(1).max(40),
  telemetry: z.object({
    balance: z.number().finite().optional(),
    equity: z.number().finite().optional(),
    freeMargin: z.number().finite().optional(),
    openPositions: z.number().int().min(0).max(1000).optional(),
    dealsToday: z.number().int().min(0).max(10000).optional(),
    symbol: z.string().max(64).optional(),
    broker: z.string().max(120).optional()
  }).strict().default({})
}).strict();

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!withinRateLimit(`ea:${forwarded}`)) return noStoreJson({ authorized: false, reason: "rate limited" }, { status: 429 });
  const licenseKey = request.headers.get("x-license-key");
  if (!licenseKey || !/^GANN-(?:[A-F0-9]{5}-){3}[A-F0-9]{5}$/.test(licenseKey)) {
    return noStoreJson({ authorized: false, reason: "invalid license" }, { status: 401 });
  }
  try {
    const body = requestSchema.parse(await request.json());
    const { data, error } = await createAdminClient().rpc("validate_ea_license", {
      p_key_fingerprint: fingerprint(licenseKey),
      p_account_number: body.accountNumber,
      p_device_fingerprint: body.deviceFingerprint,
      p_nonce: body.nonce,
      p_ea_version: body.eaVersion,
      p_telemetry: body.telemetry
    });
    if (error) throw error;
    const result = data?.[0];
    if (!result) throw new Error("No license result");
    return noStoreJson({
      authorized: result.authorized,
      reason: result.reason,
      expiresAt: result.expires_at,
      heartbeatMinutes: 15,
      offlineGraceMinutes: 720
    }, { status: result.authorized ? 200 : 403 });
  } catch (error) {
    console.error("EA validation failed", error);
    return noStoreJson({ authorized: false, reason: "validation unavailable" }, { status: 503 });
  }
}
