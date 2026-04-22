import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets / images / favicon — auth cookies don't matter there.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg|icon-.*\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
