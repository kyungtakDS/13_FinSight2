import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

function redirectUrl(request: NextRequest, pathname: "/" | "/dashboard") {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  return new URL(pathname, origin);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(redirectUrl(request, "/"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  return NextResponse.redirect(
    redirectUrl(request, error ? "/" : "/dashboard"),
  );
}
