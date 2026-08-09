import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_ORIGIN, SITE_STRAP } from '@/components/site/routes'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'
import './globals.css'

/**
 * The root layout. Header above, footer below, on every route including `/p/{slug}` and
 * everything under `/me` (§7.14).
 *
 * Nothing here reads the session. `auth()` is never called anywhere in this tree and
 * structurally cannot work on a public page — the `clerkMiddleware` matcher covers only
 * `/me`, `/ops`, `/api` and `/__clerk` (§4.6.1) — so every public render is
 * byte-identical for every viewer and carries no `Set-Cookie`.
 */

/**
 * Root Open Graph defaults, inherited by every route through metadata merging (§7.16.5).
 * **No OG string in this site is authored**: the description below is the header strap,
 * verbatim, and no route ever overrides the image. `twitter.card` is `summary` rather
 * than `summary_large_image` — there is one small shared image and nothing to fill a wide
 * frame with. Generated OG images are banned outright, and the ban is a CI grep over the
 * source for the two symbols that would implement one — so neither is named here either.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: SITE_STRAP,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_STRAP,
  },
  twitter: { card: 'summary' },
}

/**
 * `<ClerkProvider>` stays in the root layout **without** the `dynamic` prop (§4.6.1) —
 * with it, the provider reads the session on the server and takes every public page out
 * of the cache.
 *
 * It is mounted only when a publishable key is present, because §4.8's dev tier 1 leaves
 * both Clerk keys blank and every signed-out surface has to work without them. The
 * provider throws on a missing key, so this guard is what makes a checkout with no Clerk
 * account build and run.
 */
const CLERK_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const document = (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )

  return CLERK_CONFIGURED ? <ClerkProvider>{document}</ClerkProvider> : document
}
