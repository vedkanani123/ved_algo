import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

export function apiError(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "Request could not be completed" }, { status: 500 });
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}
