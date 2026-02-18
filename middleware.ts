import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
    // For Firebase, we handle auth on the client side
    // This middleware just passes through - auth state is managed by Firebase SDK
    return NextResponse.next({
        request: {
            headers: request.headers,
        },
    })
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api routes (they handle their own auth)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
