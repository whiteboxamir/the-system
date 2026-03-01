import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/levels"];

// Routes that authenticated users should be redirected away from
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
    const { user, supabaseResponse, supabase } = await updateSession(request);
    const path = request.nextUrl.pathname;

    // Redirect unauthenticated users from protected routes
    const isProtected = PROTECTED_ROUTES.some((route) =>
        path.startsWith(route)
    );

    if (isProtected && !user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirect", path);
        return Response.redirect(url);
    }

    // Redirect authenticated users away from auth routes
    const isAuthRoute = AUTH_ROUTES.some((route) => path.startsWith(route));

    if (isAuthRoute && user) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return Response.redirect(url);
    }

    // For Level 1+ content, check subscription status
    if (path.startsWith("/levels/") && user) {
        // Extract level info from the URL — we need to check if it's Level 1+
        // The actual subscription check happens at the API/page level
        // since we need to query the database for the level's order.
        // The middleware ensures authentication; API routes enforce subscription.
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
