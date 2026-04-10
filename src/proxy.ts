import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// DEV: skip Clerk middleware when secret key is missing (local preview)
export default process.env.CLERK_SECRET_KEY
  ? clerkMiddleware()
  : function noopMiddleware() { return NextResponse.next() }

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
