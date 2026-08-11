import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const LICENSE_PREFIX = "GANN";

function encryptionKey() {
  const key = Buffer.from(serverEnv().LICENSE_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) throw new Error("LICENSE_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

export function fingerprint(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decrypt(value: string) {
  const payload = Buffer.from(value, "base64url");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function generateLicenseKey() {
  const chunks = randomBytes(10).toString("hex").toUpperCase().match(/.{1,5}/g)!;
  return `${LICENSE_PREFIX}-${chunks.join("-")}`;
}

export type IssueLicenseInput = { label: string; expiresAt: string; allowedAccount?: string | null; createdBy: string };

export async function issueLicense(input: IssueLicenseInput) {
  const licenseKey = generateLicenseKey();
  const admin = createAdminClient();
  const { data, error } = await admin.from("ea_licenses").insert({
    customer_label: input.label,
    expires_at: input.expiresAt,
    allowed_account: input.allowedAccount ? Number(input.allowedAccount) : null,
    max_devices: 1,
    key_fingerprint: fingerprint(licenseKey),
    key_ciphertext: encrypt(licenseKey),
    status: "active",
    created_by: input.createdBy
  }).select("id, customer_label, expires_at, status, created_at").single();
  if (error) throw error;
  await audit(input.createdBy, data.id, "license.created", { label: input.label, expiresAt: input.expiresAt });
  return { ...data, licenseKey };
}

export async function audit(actorId: string, licenseId: string | null, action: string, detail: Record<string, unknown> = {}) {
  const { error } = await createAdminClient().from("ea_audit_log").insert({
    actor_id: actorId, license_id: licenseId, action, detail
  });
  if (error) throw error;
}

export async function getLicense(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("ea_licenses").select("*").eq("id", id).single();
  if (error) throw error;
  const [heartbeats, auditRows] = await Promise.all([
    admin.from("ea_heartbeats").select("*").eq("license_id", id).order("received_at", { ascending: false }).limit(50),
    admin.from("ea_audit_log").select("*").eq("license_id", id).order("created_at", { ascending: false }).limit(50)
  ]);
  if (heartbeats.error) throw heartbeats.error;
  if (auditRows.error) throw auditRows.error;
  return { ...data, licenseKey: decrypt(data.key_ciphertext), heartbeats: heartbeats.data, audit: auditRows.data };
}

export async function listLicenses() {
  const { data, error } = await createAdminClient().from("ea_licenses")
    .select("id, customer_label, status, expires_at, allowed_account, bound_device_fingerprint, last_seen_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export type RecentHeartbeat = {
  id: number | string;
  license_id: string;
  received_at: string;
  account_number: number | string;
  device_fingerprint: string;
  ea_version: string;
};

export async function listRecentHeartbeats() {
  const { data, error } = await createAdminClient().from("ea_heartbeats")
    .select("id, license_id, received_at, account_number, device_fingerprint, ea_version")
    .order("received_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data as RecentHeartbeat[];
}

export async function actionLicense(actorId: string, id: string, action: "extend" | "suspend" | "revoke", expiresAt?: string) {
  const admin = createAdminClient();
  const update = action === "extend" ? { expires_at: expiresAt, status: "active" } : { status: action === "suspend" ? "suspended" : "revoked" };
  const { data, error } = await admin.from("ea_licenses").update(update).eq("id", id).select("id").single();
  if (error) throw error;
  await audit(actorId, data.id, `license.${action}`, action === "extend" ? { expiresAt } : {});
}

export function setFile({ licenseKey, apiUrl }: { licenseKey: string; apiUrl: string }) {
  // MT5 .set files are intentionally simple key/value files. They cannot be both hidden from
  // the terminal and usable by it, so access is enforced by the server, not by file secrecy.
  return [
    "; Gann PRO secure activation package — do not share",
    `InpLicenseKey=${licenseKey}`,
    `InpLicenseApiUrl=${apiUrl}`,
    "InpLicenseHeartbeatMinutes=15"
  ].join("\r\n");
}
