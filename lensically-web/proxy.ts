import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const scheme = forwardedProto || request.nextUrl.protocol.replace(":", "");

  if (scheme.toLowerCase() !== "https") {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https:";
    return NextResponse.redirect(secureUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
