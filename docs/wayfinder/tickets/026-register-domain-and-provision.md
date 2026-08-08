---
id: 026
title: Register the domain and provision the production estate
type: task
status: out-of-scope
assignee:
blocked_by: [025]
---

## Question

Sixteen ordered actions that only the human can take, and five closed decisions waiting on
them.

[The blob host and the site's domain](025-blob-host-and-domain.md) decided what to buy and
why; this ticket is the buying. It is `type: task` because nothing here is a decision — every
choice is already made — and because the agent physically cannot do any of it: it needs a
card, a browser session and an account holder.

The ordered checklist, with what each step unblocks, is
[in 025's asset, §6](assets/blob-host-and-domain.md). In summary: choose the name
(`xerhero.com` recommended), create the Cloudflare account, register the domain with
auto-renew on, wait for the zone to read Active on the Free plan, add the card R2 requires
(018) and create the bucket, attach `blobs.xerhero.com` as a custom domain, **leave the
`r2.dev` development URL disabled**, add the one Cache Rule, confirm no Response Header
Transform Rule touches the blob host, mint three tokens (R2 object-scoped for the app, R2
admin and a purge-scoped Cloudflare token for the laptop only), attach `xerhero.com` and
`www` to the Vercel project as DNS-only records with the `.vercel.app` host redirecting to the
apex, fill `<site-origin>` and run `ops bucket apply`, then the Google OAuth client and the
Clerk production instance, then GitHub branch protection and Actions notifications.

What is unimplementable until this closes, stated as capability rather than quality: 017's
step 3 and therefore 003's *bytes hard-delete*; 024's `edge_drift` rule in its entirety and
its `takedown.purge.landed` definition; 013's edge enforcement; 011's CORS document, which
contains the literal string `<site-origin>`; and — the one that reorders the runway — **Clerk
production, and therefore sign-in, presign, upload, votes, bookmarks and `/me`**.

This ticket closes when the checklist is done and 024's `edge_drift` can go green. It produces
no design artefact; the record it leaves is `docs/operating.md`.
