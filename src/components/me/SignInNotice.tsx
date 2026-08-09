import styles from './me.module.css'

/**
 * What every authenticated surface renders when **both Clerk keys are blank** — §4.8's dev
 * tier 1, which is the state a contributor's first checkout is in.
 *
 * Every signed-out surface has to keep working without them, so the middleware is a
 * passthrough in that case and these pages render this instead of throwing. **A no-auth dev
 * mode is refused**: Clerk ships no emulator, and a `DEV_USER_ID` honoured in production
 * makes every visitor that user, silently. So the honest tier-1 answer is that this half of
 * the site is switched off, said plainly, with the two keys named.
 */
export function SignInNotice() {
  return (
    <div className={styles.notice}>
      <p className={styles.noticeTitle}>Sign-in is not configured on this deployment.</p>
      <p>
        This checkout has no Clerk keys, so there is nobody to be signed in as. Everything public
        works — the shelf, every programme page, the contributor pages and the legal texts — and
        uploading, upvoting, bookmarking and this space do not.
      </p>
      <p>
        To switch it on, set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{' '}
        <code>CLERK_SECRET_KEY</code> in <code>.env.local</code> from a free Clerk development
        instance. No Google Cloud project is needed: a development instance uses Clerk&rsquo;s own
        shared OAuth credentials.
      </p>
    </div>
  )
}
