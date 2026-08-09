import styles from './me.module.css'

/**
 * The tab strip: **four plain links**, no facets, no search, no sort control, no client state
 * and no tab component (§6.12). Bare `/me` is the default tab and there is no redirect.
 *
 * The current tab is passed in by the page that renders it rather than read from a router,
 * which is what keeps this a server component with nothing in the bundle.
 */
export type MeTab = 'index' | 'bookmarks' | 'votes' | 'account'

const TABS: { key: MeTab; href: string; label: string }[] = [
  { key: 'index', href: '/me', label: 'Uploads' },
  { key: 'bookmarks', href: '/me/bookmarks', label: 'Saved' },
  { key: 'votes', href: '/me/votes', label: 'Upvoted' },
  { key: 'account', href: '/me/account', label: 'Account' },
]

export function MeTabs({ current }: { current: MeTab }) {
  return (
    <nav className={styles.tabs} aria-label="Your space">
      {TABS.map((tab) => (
        <a
          key={tab.key}
          className={`${styles.tab} ${tab.key === current ? styles.tabOn : ''}`}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  )
}
