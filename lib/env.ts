import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OWNER_EMAIL: z.string().email().transform((value) => value.toLowerCase()),
  OWNER_ACCESS_CODE_HASH: z.string().regex(/^scrypt\$[^$]+\$[^$]+$/, "OWNER_ACCESS_CODE_HASH must be a scrypt hash"),
  LICENSE_ENCRYPTION_KEY: z.string().min(40),
  APP_ORIGIN: z.string().url()
});

export function serverEnv() {
  return serverSchema.parse(process.env);
}

export function publicEnv() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = serverEnv();
  return { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}
