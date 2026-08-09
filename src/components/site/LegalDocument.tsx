import styles from './LegalDocument.module.css'
import {
  CURRENT_TERMS_VERSION,
  LEGAL_TITLES,
  LEGAL_VERSION_DATES,
  type LegalKind,
  legalHref,
  readLegalDocument,
  shippedVersions,
  versionNumber,
} from './legal'
import { Markdown } from './Markdown'
import { PageShell } from './PageShell'

/**
 * A legal text at one version: the generated header block, then the immutable markdown.
 *
 * The header block is generated rather than written into the file because it names things
 * that change after a version ships — which versions exist, and which one is current —
 * while the file itself is never edited (§7.10). "Last changed" is the date that version
 * was committed, held beside the constant rather than inside the text.
 *
 * The version index is rendered as plain links, not a picker: a dropdown would be a client
 * component on a page that has no JavaScript at all (§7.14).
 */
export function LegalDocument({ kind, version }: { kind: LegalKind; version: string }) {
  const title = LEGAL_TITLES[kind]
  const number = versionNumber(version)
  const current = version === CURRENT_TERMS_VERSION
  const versions = shippedVersions()
  const date = LEGAL_VERSION_DATES[version]

  return (
    <PageShell width="prose">
      <div className="prose">
        <h1>{title}</h1>
        <div className={styles.header}>
          <p>
            <strong>
              {title} &mdash; version {number}.
            </strong>{' '}
            {date ? `Last changed: ${formatDate(date)}.` : null}
          </p>
          {!current ? (
            <p className={styles.superseded}>
              This is not the current version. The current {title.toLowerCase()} is at{' '}
              <a href={`/${kind}`}>/{kind}</a>.
            </p>
          ) : null}
          <p className={styles.versions}>
            Every version stays published at its own URL:{' '}
            {versions.map((v, index) => (
              <span key={v}>
                {index > 0 ? ', ' : null}
                {v === version ? (
                  <span>{legalHref(kind, v)}</span>
                ) : (
                  <a href={legalHref(kind, v)}>{legalHref(kind, v)}</a>
                )}
              </span>
            ))}
            .
          </p>
          {kind === 'terms' ? (
            <p>
              If you have published a programme here, the version you accepted is recorded against
              that upload and linked from it.
            </p>
          ) : null}
        </div>
        <Markdown source={readLegalDocument(kind, version)} />
      </div>
    </PageShell>
  )
}

/** `2026-08-09` → `9 August 2026`. Fixed locale and UTC, so the build is deterministic. */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))
}
