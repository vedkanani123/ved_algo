import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "connect-src 'self' https://oefrwjdefqnpsubuxpmu.supabase.co"
    ].join("; ")
  );
  if (request.nextUrl.pathname.startsWith("/api/ea/")) {
    response.headers.set("Access-Control-Allow-Origin", "null");
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
