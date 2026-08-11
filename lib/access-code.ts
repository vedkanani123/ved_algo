import "server-only";
import { createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { serverEnv } from "@/lib/env";

const scrypt = promisify(scryptCallback);
export const OWNER_ACCESS_COOKIE = "algo_owner_access";
const ACCESS_PROOF_LIFETIME_SECONDS = 60 * 60 * 12;

function sign(value: string) {
  return createHmac("sha256", serverEnv().LICENSE_ENCRYPTION_KEY).update(value).digest("base64url");
}

function equal(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verifies a scrypt hash; the fixed access code is never stored in source or returned to the browser. */
export async function verifyOwnerAccessCode(code: string) {
  if (!/^\d{16}$/.test(code)) return false;
  const [algorithm, salt, encodedHash] = serverEnv().OWNER_ACCESS_CODE_HASH.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  if (expected.length !== 32) return false;
  const derived = Buffer.from((await scrypt(code, Buffer.from(salt, "base64url"), expected.length)) as ArrayBuffer);
  return equal(derived, expected);
}

export function createOwnerAccessProof(userId: string) {
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const payload = `${userId}.${issuedAt}`;
  return `${issuedAt}.${sign(payload)}`;
}

export function hasValidOwnerAccessProof(userId: string, proof?: string) {
  if (!proof) return false;
  const [issuedAt, signature, extra] = proof.split(".");
  if (!issuedAt || !signature || extra || !/^\d+$/.test(issuedAt)) return false;
  const age = Math.floor(Date.now() / 1000) - Number(issuedAt);
  if (age < 0 || age > ACCESS_PROOF_LIFETIME_SECONDS) return false;
  return equal(Buffer.from(signature), Buffer.from(sign(`${userId}.${issuedAt}`)));
}

export const ownerAccessCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "strict" as const,
  secure: true,
  maxAge: ACCESS_PROOF_LIFETIME_SECONDS,
};
