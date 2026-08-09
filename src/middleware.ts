import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * The matcher is the load-bearing line of the whole caching design (§4.6.1, §4.7).
 *
 * Routing Middleware runs globally **before the cache** and is billed on the same meters as
 * everything else, so Clerk's quickstart catch-all would put a billed invocation in front of
 * every CDN hit and cost the caching strategy everything, *invisibly*. It also refreshes the
 * session cookie, and a response carrying `Set-Cookie` is uncacheable by Vercel's own
 * criteria. One line answers the cost and the correctness together.
 *
 * The narrowing pays twice: `auth()` *"requires `clerkMiddleware()` to be configured"*, so a
 * developer who reaches for the session on `/p/{slug}` gets an error on the first request
 * rather than an uncacheable page discovered by a bill.
 *
 * Seven prefixes and **nothing else**: §4.7's four, plus §10.1's three upload routes as the
 * fourth, fifth and sixth authenticated prefixes. A crawler hitting an upload route is
 * redirected exactly as on `/me`, which is why no upload page carries a `noindex` header.
 */
export const config = {
  /**
   * §10.2 fixes the function runtime as **Node.js, not Edge, everywhere**, and middleware is
   * the one place that has to say so out loud: Next defaults it to Edge, so the rule is
   * silently broken by omission rather than by a decision. It also matters to the meter — the
   * Active CPU figures in §4 were all measured on Node, and §10.2 names invalidating them as
   * the one caveat on this being overturnable.
   */
  runtime: 'nodejs',
  matcher: [
    '/me/:path*',
    '/ops/:path*',
    '/api/:path*',
    '/__clerk/(.*)', // Clerk's own frontend API proxy routes
    '/upload/:path*',
    '/p/:slug/upload/:path*',
    '/p/:slug/fork/:path*',
  ],
}

/**
 * The page prefixes that must never render signed-out. `/api` is deliberately **not** here:
 * `/api/sweep` authenticates with a bearer secret rather than a session, and `/api/viewer`
 * answers a stale cookie with the signed-out payload instead of a redirect. Every route
 * handler states its own gate.
 */
const isAuthenticatedPage = createRouteMatcher([
  '/me(.*)',
  '/ops(.*)',
  '/upload(.*)',
  '/p/(.*)/upload(.*)',
  '/p/(.*)/fork(.*)',
])

/**
 * Both Clerk keys are blank in dev tier 1 (§4.8, §4.9) and every signed-out surface has to
 * keep working without them. `clerkMiddleware()` is never *constructed* in that case — the
 * ternary evaluates one branch — so a checkout with no Clerk account serves the whole public
 * site and reaches the pages' own "sign-in is not configured here" state instead of a crash.
 *
 * Read statically rather than through `lib/env` so the value is inlined into the middleware
 * bundle, which is compiled separately from the server graph.
 */
const CLERK_CONFIGURED = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
)

export default CLERK_CONFIGURED
  ? clerkMiddleware(async (auth, request) => {
      if (isAuthenticatedPage(request)) await auth.protect()
    })
  : () => NextResponse.next()
