'use server'

import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { getDb } from '@/lib/db/client'
import { takedownReport } from '@/lib/db/schema'
import { env } from '@/lib/env'

/**
 * The `/report` submit path (§7.6).
 *
 * **The row is the system of record.** The app sends no mail — there is no mail vendor in
 * the estate — so a form that emails the operator is not buildable and is not built. The
 * published mailbox on the page is a second channel, and anything arriving there is
 * transcribed into a row by the operator before adjudication.
 *
 * `class` is **operator-assigned, never reporter-declared**, so the form has no field for
 * it and this action never writes one.
 *
 * The case id is not returned to the reporter: publishing it invites correlation across
 * takedowns, and it lives operator-side only (§7.5).
 */

export type ReportField =
  | 'subject_ref'
  | 'reported_reason'
  | 'name_as_it_appears'
  | 'reporter_contact'
  | 'turnstile'

export type ReportFormState = {
  status: 'idle' | 'ok' | 'error'
  /** One line, shown above the form. Never a promise about what happens next (§7.4). */
  message?: string
  fieldErrors?: Partial<Record<ReportField, string>>
}

export const REPORT_INITIAL_STATE: ReportFormState = { status: 'idle' }

/** Column budgets. Generous, but a public unauthenticated write is not unbounded. */
const LIMITS: Record<Exclude<ReportField, 'turnstile'>, number> = {
  subject_ref: 2_000,
  reported_reason: 10_000,
  name_as_it_appears: 500,
  reporter_contact: 500,
}

function read(form: FormData, field: Exclude<ReportField, 'turnstile'>): string {
  const raw = form.get(field)
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * Cloudflare Turnstile, which runs in the browser on this one form only (§7.15).
 *
 * **Verification is skipped when `TURNSTILE_SECRET_KEY` is unset**, because §4.8's dev
 * tier 1 ships blank keys and the form has to work on a checkout with no Cloudflare
 * account — the widget is absent there too, so there is no token to send. When the secret
 * is set, a missing or rejected token fails the submission.
 */
async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = env.turnstileSecret
  if (!secret) return true
  if (!token) return false

  const body = new FormData()
  body.set('secret', secret)
  body.set('response', token)
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    if (!response.ok) return false
    const result = (await response.json()) as { success?: boolean }
    return result.success === true
  } catch {
    return false
  }
}

export async function submitReport(
  _previous: ReportFormState,
  form: FormData,
): Promise<ReportFormState> {
  const values = {
    subject_ref: read(form, 'subject_ref'),
    reported_reason: read(form, 'reported_reason'),
    name_as_it_appears: read(form, 'name_as_it_appears'),
    reporter_contact: read(form, 'reporter_contact'),
  }

  const fieldErrors: ReportFormState['fieldErrors'] = {}
  if (values.reported_reason === '') {
    fieldErrors.reported_reason = 'Say what is wrong. This is the one field the record needs.'
  }
  for (const [field, limit] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    if (values[field].length > limit) {
      fieldErrors[field] = `Too long — ${limit} characters at most.`
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', fieldErrors }
  }

  const requestHeaders = await headers()
  const forwardedFor = requestHeaders.get('x-forwarded-for')
  const remoteIp = forwardedFor?.split(',')[0]?.trim() ?? null

  const turnstileToken = form.get('cf-turnstile-response')
  const passed = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : '',
    remoteIp,
  )
  if (!passed) {
    return {
      status: 'error',
      fieldErrors: { turnstile: 'The spam check did not pass. Reload the page and try again.' },
    }
  }

  // TODO(db): per-IP rate limit (§7.6). It needs a store §2.10 does not define — the schema
  // has no rate-limit table and the estate has no Redis — so the limit is unimplemented
  // rather than faked. `remoteIp` is read above and is the key it would use.
  void remoteIp

  try {
    await getDb()
      .insert(takedownReport)
      .values({
        id: randomUUID(),
        created_at: new Date(),
        reporter_contact: values.reporter_contact || null,
        subject_ref: values.subject_ref || null,
        name_as_it_appears: values.name_as_it_appears || null,
        reported_reason: values.reported_reason,
        status: 'open',
      })
  } catch {
    return {
      status: 'error',
      message:
        'The report was not recorded. Nothing was saved. The mailbox on this page is the other way through.',
    }
  }

  return {
    status: 'ok',
    message:
      'The report is recorded. One person reads reports, in their own time. There is no automatic reply and no case reference.',
  }
}
