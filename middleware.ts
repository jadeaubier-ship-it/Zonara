import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

const roleHome = {
  ADMIN: "/admin/dashboard",
  DEV: "/admin/dashboard",
  CANDIDATE: "/candidat/dashboard",
  FRANCHISEE: "/franchisee/dashboard"
};

export default withAuth(
  function middleware(request) {
    const token = request.nextauth.token;
    const pathname = request.nextUrl.pathname;

    if (pathname === "/login" && token?.role) {
      return NextResponse.redirect(new URL(roleHome[token.role as keyof typeof roleHome], request.url));
    }

    if (pathname.startsWith("/admin") && !["ADMIN", "DEV"].includes(String(token?.role))) {
      return NextResponse.redirect(new URL(roleHome[token?.role as keyof typeof roleHome] ?? "/login", request.url));
    }

    if (pathname.startsWith("/candidat") && token?.role !== "CANDIDATE") {
      return NextResponse.redirect(new URL(roleHome[token?.role as keyof typeof roleHome] ?? "/login", request.url));
    }

    if (pathname.startsWith("/franchisee") && token?.role !== "FRANCHISEE") {
      return NextResponse.redirect(new URL(roleHome[token?.role as keyof typeof roleHome] ?? "/login", request.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;
        if (pathname === "/" || pathname.startsWith("/onboarding") || pathname === "/login") {
          return true;
        }
        return !!token;
      }
    }
  }
);

export const config = {
  matcher: ["/login", "/admin/:path*", "/candidat/:path*", "/franchisee/:path*"]
};
