'use client'

import { useEffect, useState } from 'react'
import { OWN_SPACE_HREF, SIGN_IN_HREF, UPLOAD_HREF } from './routes'
import styles from './SiteHeader.module.css'
import { requestViewerState, type ViewerState } from './viewer-store'

/**
 * The header's right-hand cluster — the only piece of site chrome that is not identical
 * for every viewer.
 *
 * It is filled in from the browser (§6.13). The server render is the signed-out one and
 * goes to the CDN as-is; this renders `Sign in` until the single `/api/viewer` response
 * lands, and a signed-out visitor never issues the request at all.
 *
 * No avatar and no Clerk `<UserButton>`: it renders the Google profile image, and nothing
 * on this site renders `user.imageUrl` (§6.3, §7.11). Sign-out lives on `/me/account`,
 * not behind a popover.
 */
export function HeaderCluster() {
  const handle = useViewerHandle()

  return (
    <div className={styles.cluster}>
      {handle === null ? (
        <a href={SIGN_IN_HREF}>Sign in</a>
      ) : (
        <>
          <a href={UPLOAD_HREF}>Upload</a>
          <span className={styles.dot}>·</span>
          <a className={styles.handle} href={OWN_SPACE_HREF}>
            {handle}
          </a>
        </>
      )}
    </div>
  )
}

/**
 * One undismissable line under the header, signed-in only, for exactly as long as the
 * condition holds (§6.12). When both hold the removal line wins. Neither carries an
 * acknowledgement flag: a Class B tombstone matters for 30 days and a `failed` upload for
 * 24 hours, and both conditions delete themselves — storage buys nothing when the fact
 * deletes itself.
 *
 * It is a separate component from the cluster because it sits outside the header bar and
 * pushes the page down. Both subscribe; the store still issues exactly one request.
 */
export function HeaderNotice() {
  const viewer = useViewer()
  if (!viewer) return null

  const line = viewer.notices.removal
    ? 'A programme you uploaded has been removed.'
    : viewer.notices.failed
      ? "An upload didn't finish."
      : null

  if (!line) return null

  return (
    <div className={styles.notice}>
      <div className={styles.noticeInner}>
        {line} <a href={OWN_SPACE_HREF}>See your uploads →</a>
      </div>
    </div>
  )
}

function useViewer(): ViewerState | null {
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  useEffect(() => requestViewerState([], setViewer), [])
  return viewer
}

function useViewerHandle(): string | null {
  return useViewer()?.handle ?? null
}
