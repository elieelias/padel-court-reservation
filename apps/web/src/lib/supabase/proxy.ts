import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, isPublicReceiptPath } from "@/lib/route-access";

function landingPageRedirect(request: NextRequest) {
  const landingPageUrl = request.nextUrl.clone();
  landingPageUrl.pathname = "/";
  landingPageUrl.search = "";
  return NextResponse.redirect(landingPageUrl);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
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

  return response;
}
