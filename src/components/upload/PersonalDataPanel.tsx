import type { ScanPersonalData } from '@/lib/xer'
import {
  contactColumns,
  freeTextTotal,
  panelIsEmpty,
  resourceTypeLabel,
  summariseResourceTypes,
} from './personal-data'
import styles from './upload.module.css'

/**
 * The pre-publish disclosure panel (§7.8, §7.9).
 *
 * **Publish verbatim, disclose before publishing, strip nothing, screen nothing, promise
 * nothing.** No stripper is built and **no server-side PI detector exists anywhere in the
 * ingest path**; this panel is what replaces both. Its position is fixed — on the metadata
 * screen, **directly above the rights checkbox** — because the checkbox's second claim and
 * this panel are *the same claim* (§7.2).
 *
 * Its data source is the client-side scan that already ran before a byte was uploaded, so it
 * costs one render and **zero server work**. It **blocks nothing**: a blocker would fire only
 * on the measured-empty fields and never on the populated ones, and would constitute a
 * screening promise the site then fails on every free-text field. Advisory claims nothing, so
 * it cannot fail.
 *
 * It enumerates **values, not counts**, for the closed sets — nobody acts on "15 resources";
 * they act on recognising a colleague's name. Sections with nothing in them do not render.
 */
export function PersonalDataPanel({ data }: { data: ScanPersonalData }) {
  const exportedBy = [data.export_login, data.export_user_name].filter(Boolean).join(' — ')
  const notedResources = data.resources.filter((r) => r.has_notes)
  const freeText = freeTextTotal(data)

  // Keyed on position because two resources can legitimately carry the same name and the
  // list is a frozen snapshot of one scan — never reordered, never appended to.
  const resources = data.resources.map((resource, index) => ({
    key: `${index}:${resource.name}`,
    resource,
  }))

  if (panelIsEmpty(data)) {
    return (
      <section className={styles.panel} aria-labelledby="personal-data">
        <h3 className={styles.panelTitle} id="personal-data">
          What this file says about people
        </h3>
        <p className={styles.panelLede}>
          The scan found no values in the fields it reads — the export header, the resource records
          and the audit columns. It does not review free text, and the file is published exactly as
          uploaded.
        </p>
      </section>
    )
  }

  return (
    <section className={styles.panel} aria-labelledby="personal-data">
      <h3 className={styles.panelTitle} id="personal-data">
        This file names people. It will be published exactly as uploaded.
      </h3>

      <dl className={styles.panelList}>
        {exportedBy ? (
          <Row label="Exported by" source="ERMHDR">
            {exportedBy}
          </Row>
        ) : null}

        {data.project_add_by_name ? (
          <Row label="Project added by" source="PROJECT.add_by_name">
            {data.project_add_by_name}
          </Row>
        ) : null}

        {/* One line, never a list: the distinct-value measurement says a list of
            `create_user`/`update_user` would always have length 1 (§7.8). */}
        {data.edit_users.length > 0 ? (
          <Row label="Created or updated by" source="create_user / update_user">
            {data.edit_users.join(', ')}
          </Row>
        ) : null}

        {data.resources.length > 0 ? (
          <Row label={`Resources (${data.resources.length})`} source="RSRC.rsrc_name">
            <span className={styles.panelSummary}>{summariseResourceTypes(data.resources)}</span>
            <ul className={styles.panelNames}>
              {resources.map(({ key, resource }) => (
                <li key={key}>
                  {resource.name || <span className="muted">(unnamed)</span>}{' '}
                  <span className="muted">{resourceTypeLabel(resource.type)}</span>
                  {contactColumns(resource).length > 0 ? (
                    <span className={styles.panelContact}>
                      {' '}
                      {contactColumns(resource).join(' · ')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Row>
        ) : null}

        {notedResources.length > 0 ? (
          <Row label={`Resource notes (${notedResources.length})`} source="RSRC.rsrc_notes">
            {notedResources.map((r) => r.name).join(', ')}
          </Row>
        ) : null}

        {freeText > 0 ? (
          <Row label="Free text" source="UDFVALUE.udf_text and others">
            {freeText.toLocaleString('en-GB')} values across:{' '}
            {data.free_text.map((entry) => `${entry.table}.${entry.field}`).join(', ')} — published
            as-is, not reviewed
          </Row>
        ) : null}
      </dl>

      {data.truncated ? (
        <p className={styles.panelLede}>
          The lists above are capped. This file carries more values than the panel shows.
        </p>
      ) : null}
    </section>
  )
}

function Row({
  label,
  source,
  children,
}: {
  label: string
  /** The `.xer` column the value came out of, printed so nothing here is a black box. */
  source: string
  children: React.ReactNode
}) {
  return (
    <div className={styles.panelRow}>
      <dt className={styles.panelLabel}>{label}</dt>
      <dd className={styles.panelValue}>
        {children}
        <span className={styles.panelSource}>{source}</span>
      </dd>
    </div>
  )
}
