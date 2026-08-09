import { and, desc, eq, inArray, lt, or } from 'drizzle-orm'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { shortAge } from '@/components/me/me-index'
import { PageShell, SectionHeading } from '@/components/site'
import { isOperator } from '@/lib/auth/ops'
import { clerkUserId } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import {
  ALARM_RULES,
  alarmState,
  programme,
  revision,
  type SweepActions,
  sweepRun,
  takedownReport,
} from '@/lib/db/schema'
import styles from './ops.module.css'

/**
 * `/ops` — the operator's dashboard (§5.10).
 *
 * **The sweep is the reporter, this page is the record, and the alarm is a red GitHub Actions
 * run.** The 1-hour log window is dodged rather than paid for: every durable fact in this
 * design is a Postgres row, never a log line, so counts, verdicts, failures, heartbeats and
 * reasons all outlive any retention policy.
 *
 * Authorisation is an **env-var allowlist of Clerk user ids, checked as one equality against
 * the session** — the entire authz rule is one greppable line, and changing it is a redeploy.
 *
 * **It is strictly read-only.** Every operator *write* is in the CLI, which already holds
 * production credentials and has a plan/apply discipline — so there is no write-authz
 * reasoning here, no CSRF surface and no misclick story. Nothing on this page is a button.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Operations' }

const MINUTE_MS = 60 * 1000

export default async function OpsPage() {
  const clerkId = await clerkUserId()
  // Not a 403: an unauthorised viewer learns nothing about whether this page exists.
  if (!isOperator(clerkId)) notFound()

  const db = getDb()
  const [latest] = await db.select().from(sweepRun).orderBy(desc(sweepRun.started_at)).limit(1)
  const states = await db.select().from(alarmState)
  const breaches = new Map((latest?.breaches ?? []).map((b) => [b.rule, b.count]))

  const failures = await db
    .select({
      id: revision.id,
      slug: programme.slug,
      rev_no: revision.rev_no,
      status: revision.status,
      uploaded_at: revision.uploaded_at,
      ingest_attempts: revision.ingest_attempts,
      failure_reason: revision.failure_reason,
      failure_detail: revision.failure_detail,
    })
    .from(revision)
    .innerJoin(programme, eq(programme.id, revision.programme_id))
    .where(
      or(
        eq(revision.status, 'failed'),
        and(
          eq(revision.status, 'pending'),
          lt(revision.uploaded_at, new Date(Date.now() - 2 * MINUTE_MS)),
        ),
      ),
    )
    .orderBy(desc(revision.uploaded_at))
    .limit(50)

  const cases = await db
    .select({
      id: takedownReport.id,
      status: takedownReport.status,
      created_at: takedownReport.created_at,
      subject_ref: takedownReport.subject_ref,
      reported_reason: takedownReport.reported_reason,
    })
    .from(takedownReport)
    .where(inArray(takedownReport.status, ['open', 'awaiting_owner']))
    .orderBy(desc(takedownReport.created_at))
    .limit(50)

  const finished = latest?.finished_at ?? null
  const stale = !finished || Date.now() - finished.getTime() > 60 * MINUTE_MS

  return (
    <PageShell title="Operations">
      <div className={styles.panels}>
        <section>
          <div className={`${styles.heartbeat} ${stale ? styles.stale : ''}`}>
            <span>
              {finished ? `Last sweep: ${shortAge(finished)} ago` : 'No sweep has ever finished'}
            </span>
            {latest ? <span>verdict {latest.ok === false ? 'red' : 'green'}</span> : null}
            {latest ? <span className={styles.note}>{describeActions(latest.actions)}</span> : null}
            {latest?.error ? <span className={styles.note}>{latest.error}</span> : null}
          </div>
          {stale ? (
            <p className={styles.quiet}>
              A rotated bearer secret, a 500 from the endpoint, a dead deployment or a database
              outage all look like this. The schedule is also disabled by GitHub after 60 days
              without repo activity.
            </p>
          ) : null}
        </section>

        <section>
          <SectionHeading as="h2" id="rules">
            The five rules
          </SectionHeading>
          {/* Read from the **latest `sweep_run` verdict, not recomputed**, so the page and the
              alarm can never disagree (§5.10). */}
          <div className={styles.rules}>
            {ALARM_RULES.map((rule) => {
              const state = states.find((s) => s.rule === rule)
              const count = breaches.get(rule)
              return (
                <div className={styles.rule} key={rule}>
                  <span className={styles.ruleName}>{rule}</span>
                  <span className={count === undefined ? styles.ok : styles.breach}>
                    {count === undefined ? 'clear' : `breaching · ${count}`}
                  </span>
                  <span className={styles.note}>
                    {state?.breaching_since
                      ? `since ${shortAge(state.breaching_since)} ago`
                      : 'never breached since it last cleared'}
                    {state?.last_alarmed_at
                      ? ` · alarmed ${shortAge(state.last_alarmed_at)} ago`
                      : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <SectionHeading as="h2" id="failures">
            Failed and stale-pending revisions
          </SectionHeading>
          {failures.length === 0 ? (
            <p className={styles.quiet}>None.</p>
          ) : (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Programme</th>
                    <th>State</th>
                    <th>Age</th>
                    <th>Attempts</th>
                    <th>Reason</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.slug} r{row.rev_no}
                      </td>
                      <td>{row.status}</td>
                      <td>{shortAge(row.uploaded_at)}</td>
                      <td>{row.ingest_attempts}</td>
                      <td>{row.failure_reason ?? '—'}</td>
                      {/* `failure_detail` is operator-only and this page is its **sole
                          reader**. It carries the exception and the parse position, never
                          file bytes (§5.7). */}
                      <td className={styles.detail}>{row.failure_detail ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <SectionHeading as="h2" id="takedowns">
            Open takedown cases
          </SectionHeading>
          {cases.length === 0 ? (
            <p className={styles.quiet}>None.</p>
          ) : (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Status</th>
                    <th>Age</th>
                    <th>Target</th>
                    <th>Complaint</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.detail}>{row.id}</td>
                      <td>{row.status}</td>
                      <td>{shortAge(row.created_at)}</td>
                      <td>{row.subject_ref ?? '—'}</td>
                      <td className={styles.body}>{row.reported_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* `reporter_contact` is never rendered here. The CLI prints it when the operator
              goes to act, on the same machine they reply from — so the only page that could
              leak a complainant's address does not have it to leak (§5.11). */}
          <p className={styles.quiet}>
            Contact details are deliberately absent from this page. The CLI prints them.
          </p>
        </section>
      </div>
    </PageShell>
  )
}

function describeActions(actions: SweepActions): string {
  const parts = Object.entries(actions)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .map(([key, value]) => `${key.replace(/_/g, ' ')} ${value}`)
  return parts.length > 0 ? parts.join(' · ') : 'nothing to do'
}
