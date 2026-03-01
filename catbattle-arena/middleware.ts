import { NextRequest, NextResponse } from "next/server";

function isDocumentRequest(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "document") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname || "/";
  const host = (request.headers.get("host") || "").toLowerCase();

  if (!pathname.startsWith("/_next/") && !pathname.startsWith("/api/") && host.startsWith("www.")) {
    const redirectUrl = nextUrl.clone();
    redirectUrl.protocol = "https";
    redirectUrl.host = host.slice(4);
    return NextResponse.redirect(redirectUrl, 308);
  }

  const response = NextResponse.next();
  if (isDocumentRequest(request)) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
