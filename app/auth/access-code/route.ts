import { NextResponse } from "next/server";
import { createOwnerAccessProof, OWNER_ACCESS_COOKIE, ownerAccessCookieOptions, verifyOwnerAccessCode } from "@/lib/access-code";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const owner = await requireOwner({ accessCode: false });
  const form = await request.formData();
  const code = String(form.get("accessCode") ?? "");
  if (!(await verifyOwnerAccessCode(code))) {
    return NextResponse.redirect(new URL("/login?access=invalid", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.cookies.set(OWNER_ACCESS_COOKIE, createOwnerAccessProof(owner.id), ownerAccessCookieOptions);
  return response;
}
