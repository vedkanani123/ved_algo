import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, max-age=0");
  if (request.nextUrl.pathname.startsWith("/api/ea/")) {
    response.headers.set("Access-Control-Allow-Origin", "null");
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/licenses/:path*", "/api/:path*"] };
