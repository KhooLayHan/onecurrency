import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/transfer", "/history", "/profile"];
const AUTH_ROUTES = ["/login", "/sign-up", "/forgot-password"];

const BETTER_AUTH_SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the session cookie from the request
  const sessionCookie = request.cookies.get("session")?.value;

  const isAuthenticated = BETTER_AUTH_SESSION_COOKIE_NAMES.some((cookieName) =>
    request.cookies.has(cookieName)
  );

  // If trying to access protected route while not authenticated
  if (
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) &&
    !isAuthenticated
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access auth routes while already authenticated
  if (
    AUTH_ROUTES.some((route) => pathname.startsWith(route)) &&
    isAuthenticated
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transfer/:path*",
    "/history/:path*",
    "/profile/:path*",
    "/login",
    "/sign-up",
    "/forgot-password",
  ],
};
