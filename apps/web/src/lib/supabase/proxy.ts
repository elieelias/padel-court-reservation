import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, isPublicReceiptPath } from "@/lib/route-access";

function landingPageRedirect(request: NextRequest) {
  const landingPageUrl = request.nextUrl.clone();
  landingPageUrl.pathname = "/";
  landingPageUrl.search = "";
  return NextResponse.redirect(landingPageUrl);
}

function bookPageRedirect(request: NextRequest) {
  const bookPageUrl = request.nextUrl.clone();
  bookPageUrl.pathname = "/book";
  bookPageUrl.search = "";
  return NextResponse.redirect(bookPageUrl);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let refreshedCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  if (isPublicReceiptPath(request.nextUrl.pathname)) {
    // Camera scans must work without an account, including with expired cookies.
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  const needsAuthentication = !isPublicPath(request.nextUrl.pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return needsAuthentication ? landingPageRedirect(request) : response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        refreshedCookies = cookiesToSet;
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (needsAuthentication && !data?.claims) {
    return landingPageRedirect(request);
  }

  // Once signed in, Book is the player's home. Keeping this at the request
  // boundary prevents stale links or manually entered URLs reopening landing.
  if (request.nextUrl.pathname === "/" && data?.claims) {
    const redirect = bookPageRedirect(request);
    // Preserve any tokens Supabase refreshed during this same request.
    refreshedCookies.forEach(({ name, value, options }) => redirect.cookies.set(name, value, options));
    return redirect;
  }

  return response;
}
