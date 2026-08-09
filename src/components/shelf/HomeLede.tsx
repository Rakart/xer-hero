import styles from './ShelfControls.module.css'

/**
 * The home lede (§7.13), rendered **only at the canonical bare `/`** — never at
 * `/?sector=rail`, never on page 2 — and identical for every viewer, signed in or out.
 *
 * `https://xerhero.com/` is what goes in Google's branding form as the App home page and
 * the automated check fetches that exact URL, so the description lives here rather than on
 * `/about`: nominating `/about` would bet a 2–3 business-day manual review on a reviewer's
 * reading of the word *home*, to save four sentences.
 *
 * Paragraph 2 is what satisfies "fully describe your app's functionality"; paragraph 3 is
 * the purpose statement for the Google identity. Body type, left-aligned, no background, no
 * image, no button and **no dismiss control** — a dismissible band costs a state flag and
 * produces two different first screens.
 */
export function HomeLede() {
  return (
    <div className={styles.lede}>
      <h1 className={styles.ledeHead}>
        Public Primavera P6 programmes, shared as <code>.xer</code> files.
      </h1>
      <p>
        Planners upload programmes here and they are published in full, under CC-BY 4.0. Browse the
        shelf below, open one to read its structure, logic and DCMA checks, download the original{' '}
        <code>.xer</code>, or fork it and upload your own version. Nothing here is reviewed &mdash;
        every programme is another planner&rsquo;s work, published exactly as they uploaded it.
      </p>
      <p>
        Browsing and downloading need no account. Signing in with Google is used only to sign you
        in, so that you can upload, upvote and bookmark. Your Google name, email and profile picture
        stay with the sign-in provider; this site stores a sign-in id and the Handle you choose, and
        shows neither your name nor your email anywhere.
      </p>
      <p className={styles.ledeLinks}>
        <a href="/about">About this site</a> · <a href="/terms">Terms</a> ·{' '}
        <a href="/privacy">Privacy</a>
      </p>
    </div>
  )
}
