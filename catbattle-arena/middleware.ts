import { NextRequest, NextResponse } from "next/server";
import {
  LAUNCH_GATE_CONFIG,
  isLaunchProtectedPath,
  verifyLaunchGateToken,
} from "./app/api/_lib/launchConfig";

function isDocumentRequest(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "document") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function applyNoStoreHeader(request: NextRequest, response: NextResponse): NextResponse {
  if (isDocumentRequest(request)) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname || "/";
  const host = (request.headers.get("host") || "").toLowerCase();

  if (!pathname.startsWith("/_next/") && !pathname.startsWith("/api/") && host.startsWith("www.")) {
    const redirectUrl = nextUrl.clone();
    redirectUrl.protocol = "https";
    redirectUrl.host = host.slice(4);
    return applyNoStoreHeader(request, NextResponse.redirect(redirectUrl, 308));
  }

  if (LAUNCH_GATE_CONFIG.enabled) {
    const launchCookie = request.cookies.get(LAUNCH_GATE_CONFIG.cookieName)?.value || "";
    const hasValidLaunchCookie = launchCookie ? await verifyLaunchGateToken(launchCookie) : false;

    if (pathname === "/launch" && hasValidLaunchCookie) {
      const nextParam = String(nextUrl.searchParams.get("next") || "/arena").trim();
      const safeNext = nextParam.startsWith("/") ? nextParam : "/arena";
      return applyNoStoreHeader(request, NextResponse.redirect(new URL(safeNext, request.url), 307));
    }

    if (!pathname.startsWith("/api/") && isLaunchProtectedPath(pathname) && !hasValidLaunchCookie) {
      const launchUrl = new URL("/launch", request.url);
      if (!pathname.startsWith("/api/")) {
        const nextPath = `${pathname}${nextUrl.search || ""}${nextUrl.hash || ""}`;
        launchUrl.searchParams.set("next", nextPath);
      }
      return applyNoStoreHeader(request, NextResponse.redirect(launchUrl, 307));
    }
  }

  const response = NextResponse.next();
  return applyNoStoreHeader(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
