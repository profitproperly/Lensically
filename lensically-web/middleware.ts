import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "lensically_workspace_access";
const DEFAULT_WORKSPACE_PASSWORD = "Lensically$$$$";

const PROTECTED_PATHS = [
  "/dashboard",
  "/insights",
  "/followers",
  "/post-archive",
  "/schedule",
  "/scheduled-posts",
];

async function workspaceSessionValue(password: string) {
  const encoded = new TextEncoder().encode(`lensically:${password}:workspace`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const workspacePassword =
    process.env.LENSICALLY_WORKSPACE_PASSWORD ?? DEFAULT_WORKSPACE_PASSWORD;
  const expectedSession = await workspaceSessionValue(workspacePassword);
  const currentSession = request.cookies.get(ACCESS_COOKIE)?.value;
  const hasAccess = currentSession === expectedSession;

  if (pathname === "/" && hasAccess) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isProtectedPath(pathname) || hasAccess) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/followers/:path*",
    "/insights/:path*",
    "/post-archive/:path*",
    "/schedule/:path*",
    "/scheduled-posts/:path*",
  ],
};
