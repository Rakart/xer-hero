'use client'

/**
 * *Cite this programme* (§7.3).
 *
 * **The site generates attribution from lineage it already holds; the `.xer` is never
 * modified.** The format has five record markers and no comment mechanism, so there is
 * nowhere safe to inject a credit line and doing so would break byte-identical
 * round-tripping — downloads serve original bytes.
 *
 * The site's job is making the correct string one click away, not policing what a reuser
 * does with it: off-site obligations are the reuser's, as with any CC-BY work. The string
 * is selectable text whether or not the clipboard is available, so the button is an
 * accelerator rather than the only way to get it.
 */

import { useState } from 'react'
import styles from './programme.module.css'

export function CiteBlock({ citation }: { citation: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <code className={styles.citation}>{citation}</code>
      <div className={styles.fine}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSmall}`}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(citation)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
