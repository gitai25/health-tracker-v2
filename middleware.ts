import { NextResponse } from "next/server";

// Authentication handled by Cloudflare Access
// This middleware is kept for future extensibility

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
