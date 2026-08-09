/**
 * The site chrome's public surface. Import from `@/components/site` rather than from a
 * file inside it — the shelf and the programme page both build from these, and one
 * import path is what keeps them looking like one document.
 *
 * Everything here is presentational: nothing reads the session, nothing reads Postgres,
 * nothing reads a blob. The two client components (`HeaderCluster`, `HeaderNotice`) are
 * the only viewer-dependent things in the chrome and they fill in from the browser.
 */

export { Breadcrumb, type Crumb } from './Breadcrumb'
export { Chip, type ChipTone } from './Chip'
export { HeaderCluster, HeaderNotice } from './HeaderCluster'
export { Markdown } from './Markdown'
export { PageShell } from './PageShell'
export {
  absoluteUrl,
  CC_BY_URL,
  FOOTER_LINKS,
  OPERATOR_MAILBOX,
  OPERATOR_NAME,
  OWN_SPACE_HREF,
  PUBLIC_ROUTES,
  SHELF_QUERY_PARAMS,
  type ShelfQueryParam,
  SIGN_IN_HREF,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_STRAP,
  SITEMAP_STATIC_ROUTES,
  SOURCE_REPO_URL,
  UPLOAD_HREF,
} from './routes'
export { SectionHeading } from './SectionHeading'
export { SiteFooter } from './SiteFooter'
export { SiteHeader } from './SiteHeader'
export { Stat, StatGrid } from './Stat'
export { hasClerkSession, requestViewerState, type ViewerState } from './viewer-store'
