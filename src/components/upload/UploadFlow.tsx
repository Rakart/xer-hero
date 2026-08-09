'use client'

import { useCallback, useRef, useState } from 'react'
import { SECTORS } from '@/lib/contracts/domain'
import { type ScanResult, type ScanVerdict, scanVerdict, scanXer, sizeOnlyVerdict } from '@/lib/xer'
import {
  type HashCheckResponse,
  type MetadataField,
  type MetadataValues,
  type PresignResponse,
  type SubmitRequest,
  type SubmitResponse,
  type SubmitStatusResponse,
  type UploadIntent,
  validateMetadata,
} from './contract'
import { PersonalDataPanel } from './PersonalDataPanel'
import styles from './upload.module.css'

/**
 * The upload flow (§5.1–§5.5), which is one screen and then one screen.
 *
 * The scan is **already built** and isomorphic — this component is the UI around it, never a
 * second scanner. One pass over the picked file produces the SHA-256 content hash, the
 * `ScanResult` and the gzipped blob for the PUT; every rejection in §5.3 fires here, with
 * nothing uploaded.
 *
 * **The scan is advisory in the browser and authoritative in the function.** Nothing this
 * component computes is persisted: the hash drives a lookup and nothing else, and ingest
 * recomputes every guard from the decompressed bytes it fetched itself.
 *
 * Steps 2 and 3 — presign and the PUT — start the moment the scan passes and run in the
 * background **while the metadata screen is on the glass**, which is what makes a 7 MB upload
 * cost the uploader no waiting they can perceive.
 */

export interface UploadContext {
  /** Declared by route and never detected (§5.1). */
  intent: UploadIntent
  /** The parent programme's slug, for a revision or a fork. */
  slug?: string
  parentTitle?: string
  /** What the new revision will be numbered, for the heading. */
  nextRevNo?: number
  /** §5.4's prefill table: a fork inherits the parent's description and sector. */
  prefill?: { title?: string; description?: string; sector?: string }
}

type Stage = 'pick' | 'scanning' | 'rejected' | 'metadata' | 'publishing' | 'failed'

const SECTOR_CODES = SECTORS.map((s) => s.code)
const POLL_MS = 1200
const POLL_BUDGET_MS = 15_000

export function UploadFlow({ context }: { context: UploadContext }) {
  const [stage, setStage] = useState<Stage>('pick')
  const [rejection, setRejection] = useState<{ guard: string; message: string } | null>(null)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [dedup, setDedup] = useState<HashCheckResponse | null>(null)
  const [presigned, setPresigned] = useState<PresignResponse | null>(null)
  const [problems, setProblems] = useState<Partial<Record<MetadataField, string>>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [values, setValues] = useState<MetadataValues>({
    title: context.prefill?.title ?? '',
    description: context.prefill?.description ?? '',
    sector: context.prefill?.sector ?? '',
    changeNote: '',
    handle: '',
    rights: false,
  })

  /**
   * The PUT, started at presign and awaited at submit. The gzipped blob is held by the
   * closure that started it and by nothing else: **a retry must PUT the same blob or fetch a
   * new presigned URL**, because re-gzipping can produce a length the presigned URL rejects —
   * the compressed length is not a function of the file (§5.2). There is no retry control to
   * build on that, deliberately: **the uploader's retry is the file picker** (§5.8).
   */
  const put = useRef<Promise<Response> | null>(null)

  const reject = useCallback((message: string, guard: string) => {
    setRejection({ guard, message })
    setStage('rejected')
  }, [])

  const rejectVerdict = useCallback(
    (verdict: ScanVerdict) => {
      if (!verdict.accept) reject(verdict.message, verdict.guard)
    },
    [reject],
  )

  const onPick = useCallback(
    async (file: File) => {
      setStage('scanning')
      setRejection(null)
      setFailure(null)

      // `File.size` first, because it is free. Above twice the cap nothing is read at all —
      // nothing that large is a single-project P6 export and scanning it is unbounded (§5.3).
      const early = sizeOnlyVerdict(file.size)
      if (early) return rejectVerdict(early)

      const bytes = new Uint8Array(await file.arrayBuffer())
      const result = await scanXer(bytes)
      const verdict = scanVerdict(result)
      if (!verdict.accept) return rejectVerdict(verdict)

      const gzipped = await gzip(bytes)
      setScan(result)
      // §5.4's prefill: the root `PROJWBS.wbs_name`, falling back to `PROJECT.proj_short_name`.
      // Title is required *despite* this, or the shelf fills with rows named `C1042` — the
      // fallback is the P6 *Project ID*, a code, not the human-readable name.
      setValues((current) => ({ ...current, title: current.title || (result.title_prefill ?? '') }))

      const check = await hashCheck(result)
      setDedup(check)
      if (check?.removed) {
        // A Class B tombstone's `content_hash` outlives its bytes and its quarantine, so the
        // exact file taken down cannot be re-uploaded by anyone, including under a fresh
        // account (§5.8). Class A does not block: that owner withdrew voluntarily.
        return reject(
          'This file has been removed from xer-hero and cannot be published here.',
          'removed',
        )
      }
      if (context.intent === 'new' && check?.duplicate) {
        // Rejected **with the offer**, never converted: auto-forking would attach a
        // stranger's programme as a parent the uploader never chose, and a fork carries an
        // attribution obligation plus a required change note (§5.8).
        setStage('rejected')
        setRejection(null)
        return
      }

      const minted = await presign(context, gzipped.byteLength)
      if ('error' in minted) return reject(minted.error, 'presign')
      setPresigned(minted)
      setValues((current) => ({ ...current, handle: minted.handle }))

      // Step 3, in the background, while step 4 is on screen. The headers are **signed**, so
      // the browser must send exactly these and no others (§5.4).
      put.current = fetch(minted.url, {
        method: 'PUT',
        headers: minted.headers,
        body: new Blob([gzipped as BlobPart]),
      })
      setStage('metadata')
    },
    [context, reject, rejectVerdict],
  )

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!presigned) return

      const rules = {
        requireChangeNote: context.intent === 'fork',
        requireHandle: presigned.firstUpload,
      }
      const found = validateMetadata(values, rules, SECTOR_CODES)
      setProblems(found)
      if (Object.keys(found).length > 0) return

      setStage('publishing')
      const uploaded = await put.current
      if (!uploaded?.ok) {
        setFailure('The file did not finish uploading. Pick it again.')
        setStage('failed')
        return
      }

      const body: SubmitRequest = {
        revisionId: presigned.revisionId,
        intent: context.intent,
        slug: context.slug,
        title: values.title,
        description: values.description,
        sector: values.sector,
        changeNote: values.changeNote,
        rights: values.rights,
        ...(presigned.firstUpload ? { handle: values.handle } : {}),
      }
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null
        setFailure(error?.error ?? 'The upload could not be published.')
        setStage('failed')
        return
      }

      const { slug, revisionId } = (await response.json()) as SubmitResponse
      await poll(revisionId, slug, setFailure, setStage)
    },
    [context, presigned, values],
  )

  if (!platformSupported()) return <PlatformNotice />

  /**
   * **Programme is identity**: a title, description or sector edit is never a new revision,
   * and it lives in place on `/p/{slug}` (§6.12). So on a revision upload these three are
   * shown filled and inert rather than offered as though this file could change them.
   */
  const identityEditable = context.intent !== 'revision'
  const identityHint = identityEditable
    ? null
    : 'This belongs to the programme, not to a revision. Edit it on the programme page.'

  return (
    <div className={styles.flow}>
      {stage === 'pick' || stage === 'scanning' || stage === 'rejected' ? (
        <FilePicker stage={stage} onPick={onPick} />
      ) : null}

      {rejection ? (
        <div className={styles.reject} role="alert">
          <p className={styles.rejectMessage}>{rejection.message}</p>
          <p className={styles.rejectGuard}>Nothing was uploaded.</p>
        </div>
      ) : null}

      {stage === 'rejected' && dedup?.duplicate ? <DuplicateOffer match={dedup.duplicate} /> : null}

      {scan && stage !== 'pick' && stage !== 'scanning' ? <ScanSummary scan={scan} /> : null}

      {stage === 'metadata' && dedup?.sameProject.length ? (
        <SameProjectHint matches={dedup.sameProject} />
      ) : null}

      {stage === 'metadata' && scan && presigned ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <Field
            id="title"
            label="Title"
            hint={
              identityHint ??
              'Required. It is what the shelf shows, so a project code is not enough.'
            }
            problem={problems.title}
          >
            <input
              className={styles.input}
              id="title"
              value={values.title}
              onChange={(e) => setValues({ ...values, title: e.target.value })}
              maxLength={200}
              disabled={!identityEditable}
              required
            />
          </Field>

          <Field
            id="description"
            label="Description"
            hint={identityHint ?? 'Optional.'}
            problem={problems.description}
          >
            <textarea
              className={styles.textarea}
              id="description"
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
              maxLength={4000}
              disabled={!identityEditable}
            />
          </Field>

          <Field
            id="sector"
            label="Sector"
            hint={
              identityHint ?? 'Optional, and declared rather than inferred. Blank is a real answer.'
            }
            problem={problems.sector}
          >
            <select
              className={styles.select}
              id="sector"
              value={values.sector}
              onChange={(e) => setValues({ ...values, sector: e.target.value })}
              disabled={!identityEditable}
            >
              <option value="">—</option>
              {SECTORS.map((sector) => (
                <option key={sector.code} value={sector.code}>
                  {sector.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="changeNote"
            label="What changed"
            hint={
              context.intent === 'fork'
                ? 'Required on a fork. It is the attribution the lineage line renders.'
                : 'Optional. It appears beside this revision in the selector.'
            }
            problem={problems.changeNote}
          >
            <input
              className={styles.input}
              id="changeNote"
              value={values.changeNote}
              onChange={(e) => setValues({ ...values, changeNote: e.target.value })}
              maxLength={1000}
            />
          </Field>

          {presigned.firstUpload ? (
            <Field
              id="handle"
              label="Your Handle"
              hint="This is the name your uploads are credited to. It is generated, and this is where you confirm or change it."
              problem={problems.handle}
            >
              <input
                className={styles.input}
                id="handle"
                value={values.handle}
                onChange={(e) => setValues({ ...values, handle: e.target.value })}
                maxLength={32}
              />
            </Field>
          ) : null}

          {/* Directly above the checkbox, and that position is fixed (§7.8). */}
          <PersonalDataPanel data={scan.personal_data} />

          <div className={styles.rights}>
            <label className={styles.rightsLabel} htmlFor="rights">
              <input
                id="rights"
                type="checkbox"
                checked={values.rights}
                onChange={(e) => setValues({ ...values, rights: e.target.checked })}
              />
              <span>
                I own this programme or have permission to publish it; it contains no confidential
                or commercially sensitive third-party information — and I understand that the file
                may name people, that it is published exactly as uploaded, and that nothing is
                stripped from it; and I licence it to everyone under{' '}
                <a href="/terms">CC-BY 4.0, irrevocably</a>.
              </span>
            </label>
            {problems.rights ? <p className={styles.error}>{problems.rights}</p> : null}
          </div>

          <div className={styles.actions}>
            <button className={styles.submit} type="submit">
              Publish
            </button>
          </div>
        </form>
      ) : null}

      {stage === 'publishing' ? (
        <p className={styles.status} role="status">
          Publishing. Usually a few seconds.
        </p>
      ) : null}

      {stage === 'failed' && failure ? (
        <div className={styles.reject} role="alert">
          <p className={styles.rejectMessage}>{failure}</p>
          <p className={styles.rejectGuard}>
            <a href="/me">See your uploads →</a>
          </p>
        </div>
      ) : null}
    </div>
  )
}

function FilePicker({ stage, onPick }: { stage: Stage; onPick: (file: File) => void }) {
  return (
    <div className={styles.picker}>
      <label className={styles.pickerLabel} htmlFor="xer">
        {stage === 'scanning' ? 'Reading the file…' : 'Choose a .xer export'}
      </label>
      <input
        className={styles.file}
        id="xer"
        type="file"
        accept=".xer,text/plain"
        disabled={stage === 'scanning'}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onPick(file)
        }}
      />
      <p className={styles.pickerHint}>
        The file is read in this browser first — activity count, dates, and what it says about
        people. Nothing is uploaded until you press Publish, and a file that cannot be accepted is
        never uploaded at all.
      </p>
    </div>
  )
}

function ScanSummary({ scan }: { scan: ScanResult }) {
  const range = [scan.activity_date_range.start, scan.activity_date_range.finish]
    .filter(Boolean)
    .map((value) => (value ?? '').slice(0, 10))
    .join(' → ')
  return (
    <dl className={styles.summary}>
      <Fact label="Activities" value={scan.activity_count.toLocaleString('en-GB')} />
      <Fact label="P6 version" value={scan.p6_version ?? '—'} />
      <Fact label="Dates" value={range || '—'} />
      <Fact
        label="WBS"
        value={
          scan.wbs.node_count === 0
            ? 'none'
            : `${scan.wbs.node_count} nodes, ${scan.wbs.max_depth} deep`
        }
      />
      <Fact label="Calendars" value={String(scan.calendars_in_use)} />
    </dl>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={`${styles.factValue} tabular`}>{value}</dd>
    </div>
  )
}

/** The dedup match, offered rather than applied (§5.8). */
function DuplicateOffer({ match }: { match: { slug: string; title: string; own: boolean } }) {
  return (
    <div className={styles.offer}>
      <p>
        This file is byte-identical to <a href={`/p/${match.slug}`}>{match.title}</a>, which is
        already published.
      </p>
      <p>
        {match.own ? (
          <a href={`/p/${match.slug}/upload`}>Add it there as a new revision →</a>
        ) : (
          <a href={`/p/${match.slug}/fork`}>Fork that programme instead →</a>
        )}
      </p>
    </div>
  )
}

/**
 * *"This looks like the same P6 project as X — add it there as rev N instead?"* — **a hint,
 * never a reroute** (§5.1). No property of a file distinguishes a fork from a revision; only
 * the uploader's intent does, and it is declared by the route they are standing on.
 */
function SameProjectHint({
  matches,
}: {
  matches: { slug: string; title: string; nextRev: number }[]
}) {
  return (
    <div className={styles.hint}>
      {matches.map((match) => (
        <p key={match.slug}>
          This looks like the same project as <a href={`/p/${match.slug}`}>{match.title}</a> —{' '}
          <a href={`/p/${match.slug}/upload`}>add it there as rev {match.nextRev} instead?</a>
        </p>
      ))}
      <p className={styles.hintTail}>Or carry on here, and this becomes its own programme.</p>
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  problem,
  children,
}: {
  id: string
  label: string
  hint: string
  problem?: string
  children: React.ReactNode
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <p className={styles.hint}>{hint}</p>
      {children}
      {problem ? <p className={styles.error}>{problem}</p> : null}
    </div>
  )
}

/**
 * **Platform requirements, no fallback** (§5.2). A browser lacking any of the three cannot
 * complete the upload transport regardless, so this is not a new gate — and a blind-upload
 * fallback is deliberately not shipped, because an official one would make deterministic
 * ingest failures routine and cost the estate its sharpest alarm.
 */
function platformSupported(): boolean {
  if (typeof window === 'undefined') return true
  return (
    typeof CompressionStream !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    globalThis.crypto?.subtle !== undefined
  )
}

function PlatformNotice() {
  return (
    <div className={styles.reject} role="alert">
      <p className={styles.rejectMessage}>
        This browser cannot prepare a file for upload here. It needs compression streams and
        WebCrypto, and WebCrypto needs a secure origin — an `http://` address on a local network
        removes it.
      </p>
    </div>
  )
}

// --- the four requests -------------------------------------------------------

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function hashCheck(scan: ScanResult): Promise<HashCheckResponse | null> {
  if (!scan.content_hash) return null
  const query = new URLSearchParams({ hash: scan.content_hash })
  if (scan.title_prefill) query.set('title', scan.title_prefill)
  const response = await fetch(`/api/hash-check?${query}`)
  return response.ok ? ((await response.json()) as HashCheckResponse) : null
}

async function presign(
  context: UploadContext,
  contentLength: number,
): Promise<PresignResponse | { error: string }> {
  const response = await fetch('/api/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ intent: context.intent, slug: context.slug, contentLength }),
  })
  const body = (await response.json().catch(() => null)) as PresignResponse | { error: string }
  if (!response.ok) {
    return { error: (body as { error?: string })?.error ?? 'The upload could not be started.' }
  }
  return body as PresignResponse
}

/**
 * Step 7. The flow polls the same row `/me` renders — one truth in two places (§5.9).
 *
 * On success the browser goes to `/p/{slug}`. On a timeout it goes to `/me` instead, because
 * an unpublished `/p/{slug}` **404s to everyone, owner included**: a cached route cannot
 * serve a 404 to one viewer and a page to another, which makes `/me` the only owner-visible
 * surface for an upload that has not published yet (§6.12).
 */
async function poll(
  revisionId: string,
  slug: string,
  setFailure: (message: string) => void,
  setStage: (stage: Stage) => void,
): Promise<void> {
  const deadline = Date.now() + POLL_BUDGET_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    const response = await fetch(`/api/submit?revision=${revisionId}`)
    if (!response.ok) continue
    const status = (await response.json()) as SubmitStatusResponse
    if (status.status === 'published') {
      window.location.assign(`/p/${slug}`)
      return
    }
    if (status.status === 'failed') {
      setFailure(status.failure_reason ?? 'The file could not be read.')
      setStage('failed')
      return
    }
  }
  window.location.assign('/me')
}
