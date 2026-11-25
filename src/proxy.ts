import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import type { Role } from "@/db/schema";

/**
 * Optimistic route protection. It only checks the signed session cookie so it stays fast;
 * every page and API handler re-validates the user against the database on the server.
 */
const ROLE_AREAS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/department", roles: ["DEPT_MANAGER"] },
  { prefix: "/staff", roles: ["STAFF"] },
  { prefix: "/citizen", roles: ["CITIZEN"] },
];
const PROTECTED = ["/dashboard", "/issues", "/map", "/profile", "/notifications", ...ROLE_AREAS.map((r) => r.prefix)];
const HOME: Record<Role, string> = { ADMIN: "/admin", DEPT_MANAGER: "/department", STAFF: "/staff", CITIZEN: "/citizen" };

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if ((pathname === "/login" || pathname === "/register") && session) {
    return NextResponse.redirect(new URL(HOME[session.role], req.url));
  }
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const area = ROLE_AREAS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (area && !area.roles.includes(session.role)) {
    return NextResponse.redirect(new URL(HOME[session.role], req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
