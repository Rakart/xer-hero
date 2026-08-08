---
id: 025
title: The blob host and the site's domain
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

What hostname serves the blobs, what hostname serves the site, and who pays for them?

Surfaced by [Verifying the production-only edges](024-verifying-production-only-edges.md),
which found a hard requirement nothing had costed. 017 made a **verified Cloudflare purge**
step 3 of every takedown, on the finding that purge-by-explicit-URL is available on every
plan. That is true — but **the R2 development URL (`*.r2.dev`) is not in the operator's own
Cloudflare zone, so the purge API cannot touch it.** Cache Rules, Response Header Transform
Rules and the WAF are zone features too. So an R2 **custom domain on a zone the operator
controls** is not a nicety; it is what makes 003's "bytes hard-delete" reachable at all, and
013's `noindex` and 017's 1-hour TTL are only enforceable at the edge on the same basis.

A custom domain needs a registered domain name. That is roughly **$10/year**, and it is the
first line item in this effort that is not free — against 004's finding that the platform
floor is **$0/month** until the database may no longer sleep, and 010's confirmation that
Vercel Hobby, Clerk and Neon are all genuinely $0. It is small money and it is a real change
in kind: the estate goes from *free* to *cheap*, and it needs a card and a renewal nobody
will remember.

Nothing about the site's own hostname was ever decided either. Vercel gives `*.vercel.app`
for free; Clerk's custom domain is a Pro feature (010), so on the free tier auth runs on a
Clerk-hosted subdomain regardless. So there are three hostnames in play and only one of them
currently has to be bought.

Settle:

- **Is a registered domain required, or is there a free path?** Check whether an R2 custom
  domain can be attached to a free Cloudflare-managed zone, and what the cheapest
  registrar-plus-Cloudflare-zone arrangement actually is. This is a fact to establish before
  deciding anything, in 018's style.
- **One domain or two hostnames on one domain?** `xer-hero.example` for the site and
  `blobs.xer-hero.example` for R2 is the obvious shape, and it interacts with 013: the blob
  host needs its own `robots.txt` with `Disallow: /`, which is only coherent if it is a
  separate hostname from the site a crawler is supposed to index.
- **Does the site move off `*.vercel.app`?** It costs nothing to stay, and 009 fixed
  immutable slugs so links never rot — but a `vercel.app` URL is what the site is called
  forever, and moving later means every shared `/p/{slug}` link changes host.
- **What does this do to the $0 floor?** 004's model and 010's five Pro triggers both assume
  a zero left-hand side. State the new number plainly, and whether a renewal lapse is a
  failure mode worth a rule (it is the one expiry in the estate that is not a Postgres
  predicate).
- **Who buys it, and does it block anything?** This is one of the things the agent physically
  cannot do. If it blocks 017's purge, 013's edge enforcement and 024's assertions from being
  real, say so — several closed tickets currently assume a capability that does not exist yet.

## Resolution

**Buy one `.com`, put the zone on Cloudflare's Free plan, and run four hostname
families off it. The estate goes from $0/month to $0/month plus about $11 a year —
and the domain is not a takedown expense at all. It is a launch prerequisite, because
Clerk cannot run a production instance without a domain you own.** No second domain,
no second registration, no free-subdomain cleverness, and no Worker.

Full working — the twenty verified facts with sources, the four free paths priced,
the registrar arithmetic, the hostname map and the sixteen-step provisioning
checklist — is [in the asset](assets/blob-host-and-domain.md).

### The premise inverted, and it inverted on the auth side rather than the storage side

This ticket was filed as a storage problem: `r2.dev` cannot be purged, so 017's step 3
needs a custom domain, so the effort has to spend money. That framing is correct and
it is also the *smaller half*.

**The ticket's Clerk sentence is wrong, and 010 already said so.** It reads *"Clerk's
custom domain is a Pro feature (010), so on the free tier auth runs on a Clerk-hosted
subdomain regardless."* 010's own text says the opposite — *"Custom domain and webhooks
**are** included on Free"* — and Clerk's pricing page lists *Custom domain* under the
free Hobby tier. What costs $25/month is removing the "Secured by Clerk" branding, which
010 already priced and declined.

Correcting that error uncovers a much harder fact underneath it. Clerk's own production
guide opens with *"You will need to have a domain you own."* Development instances are
capped at **100 users** and stamp development prefixes on everything. There is no
documented path to a Clerk production instance on a Clerk-hosted hostname, on any plan,
at any price.

So the question *"does the site move off `*.vercel.app`?"* is not a preference to be
weighed against 009's immutable slugs. **The site cannot stay there and have anyone sign
in.** And that reorders the whole ticket: the domain does not gate takedown, which is a
rare event on a site that has not launched. It gates **sign-in → presign → upload**,
which is 011's entire pipeline, which is 016's votes and 023's `/me` and everything the
site does that is not read-only. The purchase is the first item on the launch runway, not
a compliance line item.

### Cloudflare's Free plan is enough, and every part of that was checked

017 assumed purge-by-URL is available on every plan. **It is** — Cloudflare's purge
documentation offers *"URL, Hostname, Tag, Prefix, and Purge Everything"* identically
across Free, Pro, Business and Enterprise, with Free rate-limited to 800 URLs/second and
100 URLs per API request. 017's purge list is a constant three URLs per revision (019),
so a limit of 100 per request is not a limit.

The rest of the estate's zone dependencies are Free too:

| Needed by | Feature | Free plan |
|---|---|---|
| 017 step 3, 024 `takedown.purge.landed` | purge by URL | **yes**, 800 URLs/s |
| 004, 017 TTL split | Cache Rules | **yes**, 10 rules |
| 013 repair path if the edge ever mangles a header | Response Header Transform Rules | **yes**, 10 rules |
| 013, 017, 024 | R2 custom domain | **yes** — the docs impose a *same-account zone* requirement and **no plan condition** |

The one honest gap: Cloudflare nowhere states in so many words that R2 custom domains
work on a Free-plan zone. It states the zone requirement without a plan qualifier, and
every dependent feature is independently documented as available on Free. That is the
strongest claim the sources support and it is the claim being made.

### There is a genuinely free path. It is rejected, and not for snobbery

Four candidates were priced ([asset §3](assets/blob-host-and-domain.md)). Three fail on
mechanics; one fails on a cost that is not in dollars.

- **Stay on `r2.dev` — $0.** Cloudflare's API reference is blunter than its marketing:
  the managed domain *"is not intended for production usage and has a **variable** rate
  limit applied to it."* Variable, so it cannot be designed against. No cache, therefore
  no purge, therefore 003's *bytes hard-delete* is decorative. Rejected twice over.
- **A free public-suffix subdomain + a free Cloudflare zone — $0.** Cloudflare will not
  let a Free account add a subdomain as its own zone (subdomain setup is **Enterprise**),
  but a child of a Public Suffix List entry *is* a registrable domain to everything that
  reads the PSL. Checked against the list itself: of `eu.org`, `js.org` and `is-a.dev`,
  only `eu.org` offers NS delegation — the other two do CNAMEs and pull requests. So
  `xerhero.eu.org` is the one real free candidate, and whether Cloudflare accepts it is
  unverified. It is rejected on operational cost: it is a manually reviewed, no-SLA,
  volunteer-run namespace, and it would put **a second unaccountable party in the path of
  "bytes hard-delete"** on a site whose entire legal posture (003) is one operator making
  no promises. Free-but-revocable is not cheap here; it is the most expensive kind of
  fragile.
- **A Worker on `workers.dev` in front of R2 — $0, and the interesting failure.** It
  nearly works. A Worker sets any header it likes, serves `robots.txt` from a route, and
  because a Worker that never touches the Cache API has no CDN cache in front of it, it
  makes purge *unnecessary* rather than impossible — delete the object and the next GET
  is a 404, which is exactly 024's definition of a verified purge. It dies on **100,000
  requests/day**: every blob read becomes a metered compute invocation, exceeding the cap
  fails the blob host for the rest of the day, and it deletes the CDN caching 004's model
  assumes. It also adds a **fifth deployable** and puts hand-written code in front of the
  one object 013 confined all personal data to. Cloudflare's posture on `workers.dev` is
  word-for-word its posture on `r2.dev`, and its recommended fix — a Workers Custom
  Domain — requires *"an active Cloudflare zone"*, which is the domain we were avoiding.
- **`pages.dev` in front of R2.** Workers with a different wrapper, plus a second hosting
  platform beside Vercel. Rejected without further pricing.

**Cheap wins over free here because free costs more.** Eleven dollars a year buys a
hostname nobody else can withdraw, on the plan we would be on anyway.

### One domain, four hostname families — and `robots.txt` is why one is enough

`xerhero.com` apex is the site and is **canonical**. `www` redirects to it.
`blobs.xerhero.com` is the R2 custom domain, proxied. Clerk takes `clerk.`, `accounts.`,
`clkmail.` and two DKIM records, all **DNS-only**, because Clerk's DNS check fails behind
a proxy. Vercel's records are **DNS-only** too — Vercel *"do not recommend using a
reverse proxy in front of Vercel"*, and Cloudflare's orange cloud in front of Vercel is
exactly that.

The ticket asked whether 013 forces two domains. It does not, and the reason is precise:
**a `robots.txt` governs its own origin and nothing else.** `blobs.xerhero.com/robots.txt`
saying `Disallow: /` says nothing whatever about `xerhero.com`. 013 needs a separate
*hostname*; it never needed a separate *registrable domain*. A second domain would buy a
second renewal, a second expiry and a second thing to forget, in exchange for nothing.

One hazard is recorded rather than engineered away: a cookie scoped to `.xerhero.com`
reaches `blobs.xerhero.com`. The `activities.json.gz` fetch is cross-origin and sends no
credentials, `derived.json` is fetched server-side, so the only cookie-bearing request is
the user's own download navigation — a GET terminating at Cloudflare, which already
terminates the site's TLS. Confirm Clerk's cookie `Domain` attribute at provisioning; if
it is host-scoped the hazard does not exist.

### The finding nobody had: the `r2.dev` URL must be switched off, and something must say so

If the custom domain is attached *and* the development URL is left enabled, the bucket
has **two public origins for the same bytes**, and 017's step 3 purges one of them.
024's `takedown.purge.landed` GETs the blob-host URL, gets its non-200, writes
`bytes_deleted_at` and reports a **verified purge that is not true** — the object is
still fetchable at `pub-….r2.dev/…`. This is a worse failure than the one 024 built the
whole instrument to catch, because it is silent *and* it reports success.

It needs an assertion, and there is one available at no cost. The Cloudflare API exposes
the setting directly — `GET /accounts/{id}/r2/buckets/{bucket}/domains/managed` returns
`{bucketId, domain, enabled}` — so **`ops bucket check` gains a third assertion,
`ops.r2dev.disabled`**, beside its CORS diff. That is a config read, which 024 banned in
the app and permitted on the laptop; `ops.cors.matches_repo` is the precedent it follows
exactly. It also, usefully, cannot be done from the sweep: if the URL is disabled there
is no hostname to probe, so behaviour-observation has nothing to observe. This is the one
place 024's *observe output, never read config* rule genuinely cannot reach.

Cloudflare also documents the tempting dodge as unsupported — *"Avoid creating a CNAME
record pointing to the r2.dev subdomain. This is an unsupported access path."* So there
is no version of this where a domain is owned and a zone is skipped.

### One Cache Rule is required, not optional — and it is not the obvious one

Cloudflare's default cached extension list includes `GZ` but *"does not cache HTML or
JSON by default."* Two of the three objects per revision are `.gz` and are cached; the
third, `derived.v{N}.json`, is **not**. Left alone, every programme page open is an R2
Class B operation, 004's caching assumption quietly does not apply to the payload that is
read most, and 024's `edge.canary.derived_cache_control` is asserting a pass-through
header rather than a cached response — green, and measuring nothing.

One rule fixes it, and its shape matters:

```
When  hostname eq "blobs.xerhero.com"
Then  Cache eligibility: Eligible for cache
      Edge TTL: Use cache-control header from origin
```

Deliberately **not** "Cache Everything with an Edge TTL override". Overriding Edge TTL is
precisely the failure 024's `edge.canary.not_stale_beyond_ttl` was written to catch, and
017's one-hour TTL on `original.xer.gz` has to arrive at the edge from the object's own
header or the takedown story breaks in the way that is invisible until a takedown.

### The new number, stated plainly

**$0/month, plus ~$11/year.**

Cloudflare sells at cost — *"you pay the registry and ICANN list price with no markup"* —
so a `.com` is Verisign's registry price plus ICANN's transaction fee: **≈ $10.46/year
today, ≈ $11.17/year from 1 November 2026**, when Verisign's 7% increase takes the
registry price from $10.26 to $10.97. Call it **$0.93 a month**. Cloudflare does not
publish per-TLD prices anywhere reachable without signing in, so the exact dashboard
figure is unverified; Vercel's registrar quotes `xerhero.com` at $11.25, which brackets it
from above.

004's headline survives in substance and needs one correction of *kind*, not size. The
finding was *"$0/month until the database may no longer sleep, then ~$20–45/month, flat in
corpus size."* The domain is **flat in everything** — corpus size, traffic, users, plan.
It is the only cost in the estate that does not respond to any variable at all, which is
why it is better described as a *subscription to the project existing* than as a floor.
Neither 010's five Pro triggers nor 004's cliff move. R2 stays inside its free tier at
launch and under $1/month at 10,000 programmes.

The change that is real is in kind, and the ticket named it correctly: **the estate stops
being free and becomes cheap.** It now needs a card that gets charged, which 018 had
already established for R2, so no new card and no new vendor — the same Cloudflare
account, the same payment method, one more line on it.

### The renewal gets no rule, and the reason is 024's own

024 established that every clock in this system is a Postgres predicate the sweep
evaluates. **This one is not**, and the temptation is to build the fifth-rule-shaped thing
that would make it one. Refused, on three grounds and one precedent.

What watches it, in order of when it fires:

1. **Auto-renew, which Cloudflare turns on by default** — *"All registrations have
   Auto-renew turned on by default."* The card is the one 018 already required for R2.
2. **The registrar's own expiry mail**, which is a channel that exists whether we like it
   or not.
3. **024's `edge_drift`, already.** A lapsed domain stops resolving, so `edge.robots_txt`
   and every `edge.canary.*` key fails, the sweep goes red on transition, and 019's
   GitHub Actions channel mails the operator within fifteen minutes. **The estate already
   alarms on a lapsed domain.** Nobody designed that; it falls out of asserting behaviour
   rather than configuration.

The precedent is 024's refusal to watch 010's five Pro triggers: *watching them would cost
a credential to learn something the vendor already tells us.* Reading the expiry date
means putting a Cloudflare account-scoped Registrar API token in the app to read a value
Cloudflare emails about — a strictly worse version of an existing channel. The alternative
— a hard-coded expiry date in the repo — is a constant that starts lying the first time
the domain renews.

**The residue is named rather than hidden: this is the one clock in the estate that alarms
after it fires rather than before.** All three defences would have to fail together for it
to matter, and the third one turns a silent outage into a red run, which is the same
bargain 024 struck everywhere else.

### What is unimplementable until the purchase happens

Not "degraded". Unimplementable — the capability does not exist and no code can create it.

- **017 step 3, and therefore 003's "bytes hard-delete".** No zone, no purge API, no
  purge-scoped token. Both takedown classes run their first two steps and stop.
  `bytes_deleted_at` is never written, so 019's rule 4 `reconciler_stuck` reddens on the
  first takedown and stays red.
- **024's `edge_drift` in its entirety.** All seven assertion keys name the blob host.
  The rule can be written; it cannot pass.
- **024's `takedown.purge.landed`** — the definition of "verified" that 017 owed.
- **013's edge enforcement.** The PUT-time half is testable in CI against MinIO (024), and
  the `robots.txt` object works on any host. What cannot exist is the assertion that *the
  edge serves* `X-Robots-Tag` back, because there is no edge we control, and no Transform
  Rule to repair it with if it does not.
- **011's CORS document.** `ops/bucket/cors.json` contains the literal string
  `<site-origin>`. It is not a placeholder awaiting a decision; it is awaiting a purchase.
- **Clerk production, and therefore sign-in, presign, upload, votes, bookmarks and `/me`.**
  The one that reorders the runway.

None of this is a design defect in 017, 013 or 024. Each of them reasoned correctly from
"a custom domain exists" and none of them was the ticket that could buy one.

### The name

Three, checked live against a registrar API on 2026-08-08 and all available then —
availability is a point-in-time fact and not a reservation.

| | Price (Vercel retail; Cloudflare at cost is lower) | The case for | The case against |
|---|---|---|---|
| **`xerhero.com`** ← **recommended** | $11.25 | the audience is construction planners, who type `.com` without thinking about it; no TLD trivia to explain in a support mail | the dearest of the three, by about $3 |
| `xerhero.dev` | $9.99 | cheapest credible, signals the open-source posture | signals *developer tool* to an audience of planners, which is the wrong room; the whole TLD is HSTS-preloaded (harmless here, permanent everywhere) |
| `xerhero.org` | $8.49 | cheapest, and fits a free CC-BY public archive with no revenue | slightly over-claims — `.org` reads as an organisation, and 003's posture is one person promising nothing |

**Take `xerhero.com`.** Unhyphenated, because the repo is `xer-hero` but nobody says the
hyphen out loud and a shared `/p/{slug}` URL is read aloud more often than it is typed.
`xer-hero.com` is also free at the same price; **do not** defensively register it, or
anything else — the standing preference is cheap, and a second registration doubles the
one recurring cost this ticket just created to defend against a typo nobody will make.

This is the one line in the ticket that is the dev's taste rather than a technical trade,
so it is a recommendation and not a decision. Any of the three works; only the number of
them matters.

### What this hands to other tickets

- **[What does storage actually cost?](004-storage-cost-model.md)** — the asterisk it
  acquired from 024 gets a number: $0/month plus ~$11/year, flat in every variable. The
  cliff and the $20–45 step are untouched.
- **[Stack, hosting and auth provider](010-stack-hosting-auth.md)** — its Clerk-on-Free
  finding is confirmed and extended in the direction nobody checked: a production instance
  needs a domain you own, so the free tier was never the constraint. Vercel Hobby custom
  domains are free (50 per project) and no sixth Pro trigger appears.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  its purge assumption is verified on the Free plan, and `ops bucket check` gains a third
  assertion, `ops.r2dev.disabled`.
- **[Personal data in published .xer files](013-personal-data-in-published-files.md)** —
  `Disallow: /` gets a hostname, and the per-origin `robots.txt` rule is what makes one
  registered domain sufficient.
- **[Verifying the production-only edges](024-verifying-production-only-edges.md)** — its
  ten-step checklist becomes sixteen, its `<blob-host>` becomes `blobs.xerhero.com`, it
  gains a required Cache Rule it did not know it needed and a third laptop assertion.
- **Build work, not a decision:** the blob host is an env var, never a literal, so CI can
  point the same code at MinIO (018).

### Flagged

- **Clerk production needs our own Google OAuth client, and nobody has costed that.** 010
  chose Clerk partly because contributors need no Google Cloud project — true in
  development, where Clerk supplies shared credentials, and false in production, where
  *"you must provide custom credentials"* and the Google app must be published *"In
  production"*. That means a Google Cloud project, an OAuth client, a verified authorized
  domain and a consent-screen publication whose review requirements for `openid email
  profile` this ticket did not establish. Filed rather than guessed.
- **The provisioning work itself is now the effort's only frontier item that an agent
  cannot advance.** Sixteen ordered steps, five closed decisions waiting on them. Filed as
  its own ticket so it is visible on the map rather than buried in an asset.
- **`ops.r2dev.disabled` is a config read, and it is the one assertion 024's
  observe-behaviour rule cannot express** — when the thing is correctly off there is no
  hostname to probe. Recorded so the exception is deliberate rather than an erosion.
- **The `.vercel.app` hostname must be made to redirect, not merely deprecated.** 009's
  immutable slugs promise a path that never rots; two live hosts serving the same path is
  the only way that promise breaks, and it breaks quietly, in other people's bookmarks.
- **Cloudflare's per-TLD prices are not publishable without an account**, so the ~$11
  figure is derived from the registry price plus the ICANN fee rather than read off a
  Cloudflare page. The ICANN $0.20 transaction fee comes from secondary sources only.
