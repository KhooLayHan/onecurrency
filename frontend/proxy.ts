import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/transfer", "/history", "/profile"];

const AUTH_REDIRECT_IF_AUTHENTICATED = [
  "/login",
  "/sign-up",
  "/forgot-password",
];

const BETTER_AUTH_SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

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

  // If trying to access auth-only routes while already authenticated.
  // /two-factor and /reset-password are NOT in this list — an
  // authenticated user still needs to complete 2FA or reset their password.
  if (
    AUTH_REDIRECT_IF_AUTHENTICATED.some((route) =>
      pathname.startsWith(route)
    ) &&
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
    "/reset-password",
    "/two-factor",
  ],
};
