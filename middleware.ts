import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    });
    // Validates/refreshes the token before a Server Component evaluates MFA assurance.
    await supabase.auth.getClaims();
  }

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
