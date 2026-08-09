'use client'

import Script from 'next/script'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { REPORT_INITIAL_STATE, submitReport } from './actions'
import styles from './ReportForm.module.css'

/**
 * The intake form (§7.6). Four fields, which are the four columns the row carries:
 * `subject_ref`, `reported_reason`, `name_as_it_appears` and `reporter_contact`.
 *
 * There is no field for the removal class: **`class` is operator-assigned, never
 * reporter-declared**, and a control asking a reporter to classify their own complaint
 * would be a form asking a question the operator answers.
 *
 * Turnstile runs here and on no other page. **The widget is absent when
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is blank** — §4.8's dev tier 1 — and the form submits
 * without it; the server skips verification in exactly the same condition.
 */
export function ReportForm() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const [state, action] = useActionState(submitReport, REPORT_INITIAL_STATE)

  if (state.status === 'ok') {
    return (
      <div className={styles.banner} role="status">
        {state.message}
      </div>
    )
  }

  return (
    <>
      {state.status === 'error' && state.message ? (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          {state.message}
        </div>
      ) : null}

      <form className={styles.form} action={action}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="subject_ref">
            What are you reporting?
          </label>
          <p className={styles.hint} id="subject_ref-hint">
            The address of the page, or the programme&rsquo;s name. Paste it as it is.
          </p>
          <input
            className={styles.input}
            id="subject_ref"
            name="subject_ref"
            type="text"
            maxLength={2000}
            aria-describedby="subject_ref-hint"
          />
          <FieldError message={state.fieldErrors?.subject_ref} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="reported_reason">
            What is wrong with it?
          </label>
          <p className={styles.hint} id="reported_reason-hint">
            Rights, confidentiality, personal data, or anything else. Say what the problem is rather
            than what you would like done about it &mdash; the outcome is decided by one person
            reading this.
          </p>
          <textarea
            className={styles.textarea}
            id="reported_reason"
            name="reported_reason"
            required
            maxLength={10000}
            aria-describedby="reported_reason-hint"
          />
          <FieldError message={state.fieldErrors?.reported_reason} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="name_as_it_appears">
            The name, exactly as it appears in the file
          </label>
          <p className={styles.hint} id="name_as_it_appears-hint">
            Only if you are reporting a person&rsquo;s name. Type it exactly as it is written in the
            programme &mdash; this is the string the operator searches the files for, and a
            paragraph describing it is what this field exists to avoid.
          </p>
          <input
            className={styles.input}
            id="name_as_it_appears"
            name="name_as_it_appears"
            type="text"
            maxLength={500}
            aria-describedby="name_as_it_appears-hint"
          />
          <FieldError message={state.fieldErrors?.name_as_it_appears} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="reporter_contact">
            How to reach you
          </label>
          <p className={styles.hint} id="reporter_contact-hint">
            An email address, or nothing. It is deleted 90 days after the case is closed. Without it
            there is no way to come back to you with a question.
          </p>
          <input
            className={styles.input}
            id="reporter_contact"
            name="reporter_contact"
            type="text"
            maxLength={500}
            autoComplete="email"
            aria-describedby="reporter_contact-hint"
          />
          <FieldError message={state.fieldErrors?.reporter_contact} />
        </div>

        {siteKey ? (
          <div className={styles.turnstile}>
            <div className="cf-turnstile" data-sitekey={siteKey} />
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              strategy="afterInteractive"
            />
            <FieldError message={state.fieldErrors?.turnstile} />
          </div>
        ) : null}

        <div className={styles.actions}>
          <SubmitButton />
        </div>
      </form>
    </>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button className={styles.submit} type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send the report'}
    </button>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className={styles.error}>{message}</p>
}
