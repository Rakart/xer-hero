# Operating the estate

The record ticket 026 leaves behind, and the answer to "what did we buy, where does it live, and
what breaks if it lapses". README §4.10 is the runbook; this is its result. **Everything below
was done or observed on 2026-08-10.**

Status: **provisioned, not launched.** The site is deliberately not serving — see
[Launch, and why nothing serves yet](#launch-and-why-nothing-serves-yet).

---

## 1. Accounts

One identity owns everything, on purpose: `carlos.greblo@gmail.com`.

| Service | Account | Plan | Costs today |
| --- | --- | --- | --- |
| Cloudflare (registrar, DNS, R2) | `Carlos.greblo@gmail.com's Account` — `e1dbaf431770650a3b370c1064f16573` | Free zone, R2 free tier | domain renewal only |
| Vercel | `rakart` / team `rakarts-projects` | **Hobby** | $0 |
| Neon (via Vercel Marketplace) | project `restless-lab-86259247` | Free | $0 |
| GitHub | `Rakart/xer-hero` — **public**, personal account | Free | $0 |
| Clerk | app `xer-hero` — `app_3Hi3xh5jyXbCSKK4b90h00dlSgy`; dev `ins_3Hi3xdem7lg303IQi0oC1hTLU9L`, prod `ins_3Hi9UsXqXvqPYTBoDzc8Wo6s3Ls` | Free | $0 |
| Google Cloud | **not yet created** | — | — |

A card is on file at Cloudflare because R2 demands one even inside the free tier. Nothing else
holds payment details.

---

## 2. The domain

`xerhero.com`, registered at Cloudflare Registrar, zone `09ef31740e251a53164937e9ddd17836`,
**active on the Free plan**, nameservers `maxim.ns.cloudflare.com` / `piper.ns.cloudflare.com`.

> **GAP — the renewal date is not recorded here.** §4.10 step 3 asks for it, and the provisioning
> token has no Registrar scope, so the API read is denied. Read it from
> <https://dash.cloudflare.com/e1dbaf431770650a3b370c1064f16573/domains/xerhero.com>, confirm
> **auto-renew is on**, and write the date in. This is the one line in this file that protects
> against losing the hostname every published `/p/{slug}` URL is built on.

Cost, for budgeting: Cloudflare sells at registry cost, ≈ **$10.46/yr** now and ≈ **$11.17/yr**
from 1 November 2026 when Verisign's `.com` price rises.

---

## 3. The hostname map

| Hostname | Serves | Record | Proxy | State |
| --- | --- | --- | --- | --- |
| `xerhero.com` | the site — canonical | `A` → `216.198.79.1`, `64.29.17.1` | DNS-only | **records removed** (not launched) |
| `www.xerhero.com` | 308 → apex | `CNAME` → `6878dd3e99442f46.vercel-dns-017.com` | DNS-only | **record removed** (not launched) |
| `xer-hero.vercel.app` | 308 → apex | — | — | redirect cleared (not launched) |
| `blobs.xerhero.com` | R2 custom domain | `CNAME` → `public.r2.dev` | **proxied** | **live**, certificate active |
| `clerk.xerhero.com` | Clerk Frontend API | `CNAME` → `frontend-api.clerk.services` | DNS-only | added 2026-08-10 |
| `accounts.xerhero.com` | Clerk accounts portal | `CNAME` → `accounts.clerk.services` | DNS-only | added 2026-08-10 |
| `clkmail.xerhero.com` | Clerk mail | `CNAME` → `mail.ojhbujxk372n.clerk.services` | DNS-only | added 2026-08-10 |
| `clk._domainkey` / `clk2._domainkey` | Clerk DKIM | `CNAME` → `dkim1` / `dkim2.ojhbujxk372n.clerk.services` | DNS-only | added 2026-08-10 |

Vercel's apex IPs and the project-specific `www` target are recorded above so relaunch is one
script rather than a hunt. The proxy states are not preferences: Vercel does not support a
reverse proxy in front of it, and Cloudflare *must* be in path for the blob host or there is no
cache, no purge and no rules. The five Clerk records are the mirror image: Clerk's own DNS check
fails against a proxied CNAME, because what it resolves is then a Cloudflare address rather than
`*.clerk.services`. Grey cloud on all five, permanently.

---

## 4. Blob storage

Bucket **`xerhero-blobs`**, location **ENAM**, standard class, jurisdiction default.

**The name is not `xerhero`, and that is deliberate.** R2 honours a location hint only the first
time a bucket of a given name is created, and the first `xerhero` landed in **OC** (Oceania)
because Cloudflare infers the hint from where the API call came from. Vercel's functions are
`iad1` and Neon is `us-east-1`, and `derived.v{N}.json` is fetched *server-side on every render*,
so an Oceania origin would have put a trans-Pacific hop on the critical path permanently —
bucket location cannot be changed after creation. Recreating under the same name kept returning
OC; a fresh name took the hint. `S3_BUCKET` is an environment variable, so the divergence from
the local MinIO default costs nothing in code.

Configured, and asserted by `pnpm ops:bucket check`:

- **CORS** from `ops/bucket/cors.json`, origins `https://xerhero.com` and `http://localhost:3000`
- **`robots.txt`** at the bucket root — `User-agent: *` / `Disallow: /`, `public, max-age=31536000, immutable`
- **`r2.dev` development URL disabled** (`pub-9bfae84697f14425ae0748cae492f346.r2.dev`). Two
  public origins for the same bytes would make `takedown.purge.landed` report a verified purge
  while the object is still fetchable at the other one
- **One Cache Rule** on the zone: `(http.host eq "blobs.xerhero.com")` → eligible for cache, edge
  TTL **from the origin header**. Deliberately not an override TTL — 017's one-hour TTL on
  `original.xer.gz` has to reach the edge from the object's own header
- **Zero response-header transform rules**, checked

Verified at the edge: `https://blobs.xerhero.com/robots.txt` returns our body, and a second GET
is a `cf-cache-status: HIT`.

### The Cloudflare robots.txt that isn't a problem

Before the object existed, `blobs.xerhero.com/robots.txt` returned **200 with Cloudflare's
Content Signals Policy**. Cloudflare serves that on Free-plan zones *whose origin has no
`robots.txt`*. Once `ops bucket apply` wrote ours, ours is what the edge serves. **No zone
setting was changed.** Worth re-checking after any future zone change, since the failure is
silent and 013's whole mitigation rests on it.

---

## 5. Credentials — what exists, where it lives, what it can do

| Credential | Lives in | Scope | Notes |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` ("Cloudflare Agent Token - 2026-08-10") | `.env.ops` | R2 edit, DNS edit, Cache Rules edit, Cache Purge, Zone read, Zone Settings edit | **also the R2 admin S3 credential** — see below |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (admin) | `.env.ops` | derived from the token above | `ops bucket apply` / `check` |
| R2 **object read/write** pair (the app's) | **Vercel production env only** | key id `1d497f6e41b194505a60a0c5a45767fc` | scope verified by probe — see below |
| `SWEEP_SECRET` | `.env.ops` + Vercel production | bearer for `POST /api/sweep` | **not yet in GitHub Actions secrets** |
| Neon production connection string | Vercel env (all three environments) | — | also written to `.env.local` by the marketplace install; see §7 |
| Clerk **dev** keys (`pk_test_` / `sk_test_`) | `.env.local` | development instance only | pulled with `clerk env pull`; see §7 for the variable-name trap |
| Clerk **production** keys | `pk_live_Y2xlcmsueGVyaGVyby5jb20k`; `sk_live_` held by Clerk only | production instance `ins_3Hi9Us…` | **not yet in Vercel** — the swap is 14.9, after Google's client exists |

**An R2 API token is its own S3 credential pair**: the Access Key ID is the token's id, and the
Secret is the SHA-256 of the token value. That is why no separate "R2 admin token" was minted —
the provisioning token already carries `Workers R2 Storage: Edit`, which is exactly the admin
role §4.8 wants on the laptop and nowhere else.

**It is also why the app cannot use it.** That pair can edit DNS and purge cache. §4.8 requires
the app's token to be object read/write and nothing more, so the app's pair was minted
separately and its scope **verified rather than assumed** — the boundary is the whole point of
there being two credentials:

| Probe | Result |
| --- | --- |
| `PutObject` / `GetObject` / `DeleteObject` on `xerhero-blobs` | allowed |
| `PutBucketCors` | **AccessDenied** |
| `ListBuckets` | **AccessDenied** |
| Cloudflare zone DNS list, zone settings, R2 bucket list | **403** |

The first `PutBucketCors` probe returned `MalformedXML` rather than `AccessDenied`, which is not
a permission verdict — it was an empty rule array. Re-probed with a valid document identical to
the live one, so that a success would have been harmless, and it denied properly.

The app's secret is in Vercel's production environment and **deliberately not in `.env.ops`**;
§4.8 puts it in Vercel and nowhere else. Recompute it from the token value if it is ever needed
locally rather than storing a second copy.

**Rolling.** The Cloudflare token's value has been in an assistant transcript. It should be
rolled once provisioning is finished. Rolling it invalidates the derived S3 pair, which must then
be recomputed rather than treated as an independent secret.

### The Clerk development instance, as configured

Clerk ships a new instance with email code *and* password sign-in alongside Google. §1.8 and §4.7
want **Google only**, so both were turned off — `auth_email.used_for_sign_in: false`,
`auth_email.sign_in_strategies: []`, `auth_password.enabled: false`:

    clerk config patch --json '{"auth_email":{"used_for_sign_in":false,"sign_in_strategies":[]},"auth_password":{"enabled":false}}'

Email address stays **enabled as stored contact information** and required at sign-up. That is
deliberate and not a leftover: it is no longer a way to sign in, but it is the value takedown
correspondence is looked up by, and §4.7 makes Clerk load-bearing for that legal process.

The **production instance** (`ins_3Hi9UsXqXvqPYTBoDzc8Wo6s3Ls`, created 2026-08-10) was cloned
from the development one, so it carries the same three settings rather than repeating the patch —
confirmed by reading its config back: `sign_in_strategies: []`, password off, Google the only
enabled connection, and no custom Google credentials yet. Its DNS and mail records verify;
`clerk deploy status` still reports `oauth: pending [google]`, which is exactly 14.9 and nothing
to fix here.

It is already serving: `https://clerk.xerhero.com/v1/environment` returns 200 with
`instance_environment_type: production`, application name `xer-hero`, home `https://xerhero.com`,
`social: ['oauth_google']` and no first-factor attributes. Two things not to misread while
checking it:

- **`ssl: in_progress` outlives the working certificate.** Both hosts already verify
  (`ssl_verify_result=0`) while the status field says otherwise. Trust the handshake.
- **`accounts.xerhero.com` answers curl with `403` and a "Just a moment…" page.** That is a
  Cloudflare managed challenge on *Clerk's* origin, not our zone — our record is grey-clouded and
  ours to control only up to the CNAME. A browser passes it. It is not a broken deployment.

Asserted rather than assumed, from the instance's own public payload
(`clerk api --fapi /environment --instance dev`): `social: ['oauth_google']`, `email_address`
present with `used_for_first_factor: false` and no `first_factors`, no password attribute. The
dashboard is not the check — the environment payload is what the sign-in page actually renders
from.

---

## 6. Launch, and why nothing serves yet

`main` built and deployed cleanly to production on 2026-08-10, and `https://xerhero.com` served
correctly — apex 200, `www` and `xer-hero.vercel.app` both 308 to it, the app's own `robots.txt`,
`/privacy` and `/terms` all live. **It was then taken down deliberately**, because the runbook
puts the domain (step 11) before Clerk (step 14), so the site would have sat publicly reachable
and unable to sign anyone in for as long as that took.

What "down" consists of, and therefore what relaunch reverses:

1. `xerhero.com` and `www.xerhero.com` removed from the Vercel project
2. The `A` and `CNAME` records for both deleted from the zone
3. The redirect on `xer-hero.vercel.app` cleared
4. The production deployment deleted
5. Vercel Authentication enabled for `prod_deployment_urls_and_all_previews`

**Hobby cannot password-protect a production URL**, so this — domains detached, work on
protected previews — is the only way to stay private on this plan. Attaching the domain is the
launch switch.

---

## 7. Traps found the hard way

- **`vercel env pull` and `vercel integration add` rewrite `.env.local` wholesale.** The Neon
  install stripped every comment and replaced the local-dev `DATABASE_URL` with the hosted one
  while leaving `NEON_FETCH_ENDPOINT` pointing at the local proxy — a config that reads as local
  and talks to production. The marketplace scopes Neon's variables to Development as well as
  Production, so this recurs on every pull. **Pull to `.env.vercel`, never to `.env.local`.**
- **`.env.ops` is loaded last by `pnpm ops:bucket` and therefore wins.** That is what points the
  CLI at production, and it is also the way to hit production by accident. The command prints its
  store, bucket and origins before doing anything; `xerhero` is MinIO and `xerhero-blobs` is R2.
- **Neon scale-to-zero cold starts fail the first request.** The first migration attempt died
  with `fetch failed` and an untouched retry succeeded. Expect the same on the first request
  after an idle period in production.
- **The Vercel CLI appended a bare `.env*` to `.gitignore`**, which would have swallowed the
  committed `.env.example`. Negated explicitly.
- **The Clerk CLI is bound to one *workspace*, and says nothing about the others.** There are two
  workspaces under `carlos.greblo@gmail.com`. `clerk apps list` shows only the bound one, and an
  app in the other returns `resource_not_found` — **identical to the response for an app that
  does not exist**, which is how this session concluded a live app had been deleted and built a
  duplicate. There is no workspace flag and no switch command in either CLI v2 or v3; the only
  lever is `clerk auth login`, which re-binds. Before trusting a 404, check the dashboard URL:
  `dashboard.clerk.com/apps/<app_id>` is the authority, the CLI is not.
- **`clerk env pull` writes `CLERK_PUBLISHABLE_KEY`**, which this app does not read — it reads
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Pull to a scratch file and copy the two values across, both
  to rename the one and to keep it away from `.env.local` for the reason in the first trap above.

---

## 8. Still to do

| # | Step | Blocked on |
| --- | --- | --- |
| 14.1–14.5, 14.7, 14.8 | Google Cloud project, Search Console domain verification, consent screen, authorized domain, scope check, OAuth client, publish | a Google account session |
| 14.9 | Google client id/secret into Clerk's production Google connection; `pk_live_`/`sk_live_` into Vercel | 14.7, 14.8 |
| 14.10–14.11 | Brand verification and a real signed-out sign-in | a live site with legal pages |
| — | Re-enable the sweep schedule in `.github/workflows/sweep.yml` | the site being live |
| — | Turn on "failed workflows only" notifications at <https://github.com/settings/notifications> | a dashboard read; nothing can assert it |
| — | Record the domain renewal date in §2 | a dashboard read |

### Step 16, done

The repo was private when provisioning started, which blocked branch protection outright (403 —
Pro or public) and would have metered the sweep at ~2,880 runs a month against 2,000 free
minutes. It was made **public** on 2026-08-10, which is what §9.5 assumed all along — fork PRs,
world-readable Actions logs and free Actions minutes are all now true statements.

`main` is protected: all four CI jobs required and **strict** (a branch must be up to date before
merging), force-pushes and deletions blocked, conversation resolution required, and
`enforce_admins` **on** — so the rule binds the owner too, which is the only way "deploy-blocking"
means anything in a one-maintainer repo. Pull requests are required with **zero** approvals,
because a sole maintainer cannot approve their own PR and any higher number is a deadlock.

Linear history was deliberately **not** required: the existing history merges PRs with merge
commits, and forcing squash/rebase would change how the repo is worked rather than what it
guarantees.
