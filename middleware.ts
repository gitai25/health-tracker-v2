import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "health-tracker-auth";
const publicPaths = ["/login", "/api/login", "/_next", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Skip public paths
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }

    // Check auth
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Verify token
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET || "change-this-secret-in-production-min-32-chars"
    );

    try {
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch {
      // Invalid token, redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch (error) {
    console.error("Middleware error:", error);
    // On error, allow request to proceed (fail open)
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
