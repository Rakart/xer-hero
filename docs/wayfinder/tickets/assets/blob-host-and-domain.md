# The blob host and the site's domain — facts, prices and the provisioning checklist

Working notes for [The blob host and the site's domain](../025-blob-host-and-domain.md).
The decisions are in that ticket's `## Resolution`; this file is the enumerated
detail it links to rather than pastes. Everything here was checked against a
primary source on **2026-08-08**; anything that could not be is marked
**UNVERIFIED** rather than asserted.

---

## 1. What was verified

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | An R2 custom domain requires the hostname's zone to be on Cloudflare | **True.** The domain must be *"added as a zone in the same account as the R2 bucket."* No plan condition is stated. | [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) |
| 2 | A **Free**-plan zone suffices for Cache Rules | **True.** Availability *Yes* on Free; **10** active rules (Pro 25, Business 50, Ent 300). | [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/) |
| 3 | A **Free**-plan zone suffices for Response Header Transform Rules | **True.** Availability *Yes* on Free; **10** active rules. Regex is Business+, which we do not need. | [Transform Rules](https://developers.cloudflare.com/rules/transform/) |
| 4 | Purge-by-URL is available on every plan (017's assumption) | **True.** *"URL, Hostname, Tag, Prefix, and Purge Everything"* are offered identically on Free, Pro, Business and Enterprise. Free rate limit **800 URLs/second**, **100 URLs per API request**. | [Purge cache](https://developers.cloudflare.com/cache/how-to/purge-cache/) |
| 5 | Purge-by-URL works for an R2 **custom domain** specifically | **True by construction.** A custom domain is a proxied hostname *inside the zone*, so its responses sit in the zone's cache and are purgeable like any other. Cloudflare documents the cache-in-front-of-R2 path as requiring exactly that custom domain. | [Enable cache in an R2 bucket](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/) |
| 6 | `*.r2.dev` cannot be purged | **True, and stronger than 024 stated** — see §2. | [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) |
| 7 | Cloudflare Registrar sells at cost | **True.** *"Cloudflare Registrar sells domains at cost: you pay the registry and ICANN list price with no markup."* Free WHOIS redaction. | [Registrar FAQ](https://developers.cloudflare.com/registrar/faq/), [Registrar product page](https://www.cloudflare.com/products/registrar/) |
| 8 | Registrar domains must use Cloudflare nameservers | **True.** *"All domains on Cloudflare Registrar use Cloudflare nameservers… those nameservers must remain in place for the domain to be Active."* | [Registrar FAQ](https://developers.cloudflare.com/registrar/faq/) |
| 9 | Auto-renew is on by default | **True.** *"All registrations have Auto-renew turned on by default. However, you may disable this option at any time."* | [Register a domain](https://developers.cloudflare.com/registrar/get-started/register-domain/) |
| 10 | Cloudflare Registrar requires an existing active zone | **Split.** For a **transfer**, yes — the domain *"must be active on Cloudflare"* on a full setup first. For a **fresh registration**, no primary statement was found either way — **UNVERIFIED**. It does not matter: adding a zone on the Free plan is free, and the fallback in §6 costs nothing. | [Transfer a domain](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/) |
| 11 | Vercel charges to attach a custom domain on Hobby | **No charge documented.** *"Hobby teams have a limit of 50 custom domains per project."* Domains are not a metered Hobby resource, and TLS is provisioned automatically. Hobby remains *"non-commercial, personal use only"* — already cleared by 010. | [Add a domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [Hobby plan](https://vercel.com/docs/plans/hobby) |
| 12 | Vercel wants Cloudflare's proxy **off** | **True.** *"We do not recommend using a reverse proxy in front of Vercel"* — it *"limits Vercel's traffic visibility… introduces latency… and creates cache management issues."* | [Using Cloudflare with Vercel](https://vercel.com/guides/using-cloudflare-with-vercel) |
| 13 | Clerk's custom domain is a Pro feature (this ticket's premise) | **False, and 010 already said so** — *"Custom domain and webhooks **are** included on Free."* Clerk's own pricing page lists *Custom domain* under the free Hobby tier; what is paid is *Remove Clerk branding* (Pro $25/mo, $20 annual). | [Clerk pricing](https://clerk.com/pricing), 010 |
| 14 | Clerk can run production on a Clerk-hosted subdomain | **False.** *"You will need to have a domain you own."* Development instances are capped at **100 users** and carry development prefixes. There is no documented Clerk-hosted production path. | [Deploy to production](https://clerk.com/docs/guides/development/deployment/production), [Managing environments](https://clerk.com/docs/guides/development/managing-environments) |
| 15 | Clerk's records must not be proxied | **True.** *"If this subdomain is reverse proxied behind a service that points to generic hostnames, such as Cloudflare, the DNS check will fail. Set the DNS record for this subdomain to a 'DNS only' mode."* | [Deploy to production](https://clerk.com/docs/guides/development/deployment/production) |
| 16 | Clerk production needs our own Google OAuth client | **True.** Development uses Clerk's shared credentials; *"For production instances, you must provide custom credentials"* and the Google app must be published *"In production"*. | [Google social connection](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) |
| 17 | A subdomain can be added to Cloudflare as its own zone on Free | **False.** Subdomain setup availability is *No / No / No / **Yes*** across Free / Pro / Business / Enterprise. | [Subdomain setup](https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/) |
| 18 | Partial (CNAME) setup lets us keep DNS elsewhere | **False on Free.** *"A CNAME setup (partial) is only available to customers on a Business or Enterprise plan."* Full setup (Cloudflare nameservers) is the only free path. | [Partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/) |
| 19 | R2 egress is free and the free tier is 10 GB | **True.** 10 GB-month storage, 1M Class A, 10M Class B per month; egress *"does not incur data transfer (egress) charges and is free."* | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| 20 | Everything the blob host serves is cached by default | **False, and it matters.** Default cached extensions include **GZ** but *"The Cloudflare CDN does not cache HTML or JSON by default."* `derived.v{N}.json` therefore needs a Cache Rule. | [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) |

---

## 2. What `*.r2.dev` actually is, past the slogan

Cloudflare's wording, verbatim where quoted:

- **Rate limited, with an undisclosed limit.** *"Public access through `r2.dev` subdomains is rate-limited and should only be used for development purposes."* The API reference is blunter: the managed domain *"is not intended for production usage and has a variable rate limit applied to it."* **Variable** — so the limit cannot be designed against, only discovered.
- **No cache.** *"To enable access management, cache, and bot management features, you must set up a custom domain."* Caching, WAF custom rules, Bot Management and access controls are listed as unavailable on `r2.dev`.
- **Therefore no purge.** Purge-by-URL is a *zone* operation; `r2.dev` is Cloudflare's zone, not ours. This is 024's finding and it survives contact with the docs.
- **No Cache Rules, no Transform Rules, no WAF.** All three are zone features; there is no zone.
- **Custom object metadata:** not documented either way for `r2.dev`. `X-Robots-Tag` set at PUT is stored as R2 object metadata and returned on GET, but whether the `r2.dev` edge returns it faithfully is **UNVERIFIED** — and unverifiable in a way that matters, because there is no Transform Rule available to repair it if it does not.
- **`robots.txt` would work.** It is an object at the bucket root, so `https://pub-….r2.dev/robots.txt` serves 013's `Disallow: /` fine. This is the one 013 requirement `r2.dev` satisfies.
- **CNAMEing to it is explicitly unsupported:** *"Avoid creating a CNAME record pointing to the r2.dev subdomain. This is an unsupported access path."* So the cheap dodge — own a domain, point a CNAME at `r2.dev`, skip the zone — is documented as not a thing.

**The consequence nobody had written down:** if the custom domain is attached *and* the `r2.dev` development URL is left enabled, the bucket has **two** public origins for the same bytes, and 017's step 3 purges only one of them. 024's `takedown.purge.landed` GETs the blob-host URL, sees a non-200, writes `bytes_deleted_at`, and reports a verified purge while the same object is still fetchable at `pub-….r2.dev/…`. The r2.dev URL must be **off**, and its being off needs an assertion.

The Cloudflare API exposes it directly — `GET /accounts/{account_id}/r2/buckets/{bucket}/domains/managed` returns `{bucketId, domain, enabled}` — so `ops bucket check` (which already holds the R2 admin token on the operator's laptop) can assert `enabled == false` alongside its CORS diff. That is a config read, which 024 banned *in the app* and permitted *on the laptop*; `ops.cors.matches_repo` is the precedent.

---

## 3. The free-path audit

Four candidates were priced. Only one is genuinely $0, and it fails on a cost that
is not measured in dollars.

### A. Stay on `*.r2.dev` — $0/year

Fails outright. No purge means 017's step 3 cannot run, which means 003's *bytes
hard-delete* is not true, which means both takedown classes are decorative. Add a
variable, undisclosed rate limit on the one URL a shared `/p/{slug}` page hands to
a planner, and it fails a second time on the product. **Rejected.**

### B. A free subdomain from a public-suffix provider + a free Cloudflare zone — $0/year

The mechanism: Cloudflare will not let a Free-plan account add `blobs.example.com`
as its own zone (subdomain setup is Enterprise, §1 #17) — **unless** the parent is
on the Public Suffix List, in which case the child *is* a registrable domain to
everything that consults the PSL.

Checked against the list itself (`publicsuffix.org/list/public_suffix_list.dat`,
fetched 2026-08-08; `===BEGIN PRIVATE DOMAINS===` at line 11277):

| Suffix | Line | Section | Delegation offered |
|---|---|---|---|
| `eu.org` | 13415 | private | **NS delegation** — you can point it at Cloudflare |
| `js.org` | 14356 | private | CNAME only — cannot become a zone |
| `is-a.dev` | 16272 | private | records-by-pull-request — cannot become a zone |
| `pages.dev`, `r2.dev`, `workers.dev` | 12728–12730 | private | Cloudflare's own; not ours to delegate |
| `vercel.app` | 16172 | private | Vercel's own |

So exactly one candidate survives the mechanics: **`something.eu.org`**, free,
NS-delegatable, run by volunteers. Whether Cloudflare in fact accepts an `eu.org`
child as a Free full zone is **UNVERIFIED** — the PSL listing makes it plausible
and Cloudflare's docs do not say.

Priced honestly, the dollar cost is $0 and the real cost is elsewhere: registration
is a manually reviewed application with no SLA and no stated turnaround, the
namespace is a volunteer service that can withdraw a name, and under 003's
one-operator / no-warranty posture this would put a **second unaccountable party in
the path of "bytes hard-delete"**. It also reads as a joke to a construction
planner being asked to trust the site with a live contract programme. Saving $11 a
year by making the estate's most legally load-bearing hostname revocable by someone
else is the wrong side of *cheap or free, and easy to use*. **Rejected on the
operational cost, not the mechanics.**

### C. A Worker on `workers.dev` in front of R2 — $0/year, and the most interesting failure

This one nearly works, and it is worth writing down why it does not.

A Worker with an R2 binding can set any response header it likes, can serve
`robots.txt` from a route, and — because a Worker that never touches the Cache API
has no CDN cache in front of it — makes purge *unnecessary* rather than impossible:
delete the R2 object and the very next GET is a 404, which satisfies 024's
`takedown.purge.landed` definition (*a plain GET of the purged URL returns
non-200*) without a purge API at all.

What it costs:

- **100,000 requests/day** on the Workers Free plan. Every blob read becomes a
  metered compute invocation instead of a free CDN hit, and exceeding the cap fails
  the blob host for the remainder of the day.
- Cloudflare's own posture is identical to `r2.dev`'s: *"It's recommended to run
  production Workers on a Workers route or custom domain, rather than on your
  workers.dev subdomain"*, which *"is treated as a Free website and is intended for
  personal or hobby projects that aren't business-critical."*
- It deletes the cache, which deletes 004's CDN-caching assumption and turns every
  download into an R2 Class B operation.
- It adds a **fifth deployable** to an estate that 018 and 024 both worked to keep
  at four, and it puts hand-written code in the path of the one object 013 confined
  all personal data to.
- A Workers **Custom Domain** — the recommended shape — needs *"an active Cloudflare
  zone"*, i.e. it needs the domain we were trying not to buy.

**Rejected.** It buys a $11/year saving with a daily request cliff and a new
component.

### D. `pages.dev` in front of R2 — same family, same answer

Pages Functions are Workers with a different wrapper; the request accounting, the
"hobby subdomain" posture and the extra deployable are unchanged, and Pages adds a
second hosting platform beside Vercel for no gain. **Rejected without further
pricing.**

---

## 4. What a name actually costs

Cloudflare charges **registry price + ICANN fee, no markup** (§1 #7). For a `.com`
that resolves to:

| Component | Amount | Source |
|---|---|---|
| Verisign `.com` registry price, today | **$10.26/yr** | [Domain Name Wire, 2026-04-23](https://domainnamewire.com/2026/04/23/breaking-verisign-raising-wholesale-com-prices/) — secondary, but quoting Verisign's own notice |
| Same, from **1 November 2026** | **$10.97/yr** (+7%) | same |
| ICANN per-transaction fee | **$0.20/yr** | secondary sources only (raised from $0.18 on 2025-07-01); **not verified** against ICANN's own fee schedule |
| **Cloudflare at-cost `.com`** | **≈ $10.46/yr now, ≈ $11.17/yr from November** | derived |

Cloudflare does not publish per-TLD prices on any page reachable without signing
in, so the exact figure the dashboard will show is **UNVERIFIED**. As a live
cross-check, Vercel's registrar API was queried on 2026-08-08 for the shortlist —
these are *retail* prices with a markup, and they bracket the at-cost number:

| Name | Available | Vercel first-year price |
|---|---|---|
| `xerhero.com` | yes | **$11.25** |
| `xer-hero.com` | yes | $11.25 |
| `xerhero.dev` | yes | **$9.99** |
| `xerhero.app` | yes | $9.99 |
| `xerhero.org` | yes | **$8.49** |
| `xerhero.net` | yes | $13.50 |
| `xerhero.io` | yes | **$37.99** |
| `xerhub.dev` | yes | $9.99 |
| `xerfiles.com` | yes | $11.25 |
| `openxer.dev` | yes | $9.99 |

Availability is a point-in-time fact from a registrar API and can change; it is not
a reservation.

`.io` is ruled out on price alone — 3.4× the `.com` for a hostname whose only job is
to be typed once and then live in a bookmark.

`.dev` carries one fact worth knowing: the whole TLD is on the **HSTS preload
list**, so every `.dev` hostname is HTTPS-only in every major browser, with no
opt-out. Harmless here — every hostname in this estate is HTTPS and 018 develops
against `localhost` — but it would bite anyone who later wanted a plain-HTTP
anything on the domain.

---

## 5. The hostname map

One registrable domain, four hostname families, no second registration.

| Hostname | Serves | DNS record | Proxy | Why |
|---|---|---|---|---|
| `xerhero.com` | the site (Vercel) — **canonical** | `A @ → 76.76.21.21` | **DNS only** | Vercel does not recommend a proxy in front of Vercel |
| `www.xerhero.com` | 308 → apex | `CNAME → cname.vercel-dns-*.com` (project-specific; read from `vercel domains inspect`) | **DNS only** | one canonical host, so 009's immutable slugs have exactly one prefix |
| `xer-hero.vercel.app` | redirect → apex | — | — | Vercel keeps serving it; making it redirect is what stops a second live host minting a second `/p/{slug}` URL |
| `blobs.xerhero.com` | R2 custom domain | created by R2 when the domain is connected | **proxied** (Cloudflare must be in path for cache, purge and rules) | 013's `Disallow: /` is only coherent on a host that is not the indexable site |
| `clerk.xerhero.com` + `accounts.`, `clkmail.`, `clk._domainkey`, `clk2._domainkey` | Clerk production | per the Clerk dashboard | **DNS only** | Clerk's DNS check fails behind a proxy |

**`robots.txt` is per-origin, which is the whole argument for one domain.** A
`robots.txt` governs its own scheme+host+port and nothing else, so
`blobs.xerhero.com/robots.txt` saying `Disallow: /` says nothing about
`xerhero.com`. 013 needs a separate **hostname**, not a separate **registrable
domain** — and a second domain would buy a second renewal, a second expiry and a
second thing to forget, for nothing.

**The one hazard of putting the blob host under the site's domain**, recorded rather
than engineered away: a cookie scoped to `.xerhero.com` is sent to
`blobs.xerhero.com`. The `activities.json.gz` fetch is cross-origin and sends no
credentials, and `derived.json` is fetched server-side, so the only cookie-bearing
request is the user's own top-level download navigation — a GET that terminates at
Cloudflare, which already terminates the site's TLS. Confirm Clerk's session-cookie
`Domain` attribute at provisioning; if it is host-scoped, this hazard does not
exist at all.

**One Cache Rule is required, not optional.** `.gz` is cached by default but
**JSON is not** (§1 #20), so `derived.v{N}.json` would be fetched from R2 on every
open and 024's `edge.canary.derived_cache_control` would be asserting a pass-through
header rather than a cached one. One rule covers it:

```
When  hostname eq "blobs.xerhero.com"
Then  Cache eligibility: Eligible for cache
      Edge TTL: Use cache-control header from origin
```

Free plan allows 10 Cache Rules; this uses one. Deliberately **not** "Cache
Everything with an override TTL" — overriding Edge TTL is precisely the failure
024's `edge.canary.not_stale_beyond_ttl` exists to catch, and 017's one-hour TTL on
`original.xer.gz` must reach the edge from the object's own header.

---

## 6. The provisioning checklist — human-only, in order

Every step here needs a card, a browser session or a human decision. None of it can
be done by an agent. The right-hand column is what stops being hypothetical.

| # | Step | Unblocks |
|---|---|---|
| 1 | **Choose the name.** Recommended `xerhero.com`. | everything below |
| 2 | Create/sign in to a Cloudflare account. The zone and the R2 bucket must live in the **same account** (§1 #1). | 3–9 |
| 3 | **Register the name at Cloudflare Registrar.** Confirm **auto-renew is on** (default) and note the renewal date in `docs/operating.md`. *Fallback if Registrar refuses a fresh registration without an existing zone (§1 #10): register anywhere cheap, then Cloudflare → Add a site → Free plan → point the registrar's nameservers at Cloudflare. Partial/CNAME setup is Business+, so full setup is the only free path.* | the zone |
| 4 | Wait for the zone to read **Active**, on the **Free** plan. | 5–9 |
| 5 | Add a payment method to Cloudflare — **R2 requires one even inside the free tier** (018) — and create the R2 bucket. | the bucket |
| 6 | R2 → bucket → **Settings → Custom Domains → Add `blobs.xerhero.com`**, confirm the DNS record, wait for the certificate. | 017 step 3; 013's edge enforcement; every one of 024's `edge.*` keys |
| 7 | **Leave the `r2.dev` public development URL disabled** (or disable it if it was enabled during setup). Two public origins for the same bytes make a verified purge a lie — §2. | the honesty of `takedown.purge.landed` |
| 8 | Add the **Cache Rule** in §5 — hostname `blobs.xerhero.com`, eligible for cache, edge TTL from origin. | `edge.canary.derived_cache_control`; 004's caching assumption |
| 9 | Confirm the zone has **no Response Header Transform Rule** touching the blob host. A fresh zone has none; the step is to check, and to check again after any future rule. | `edge.canary.x_robots_tag` |
| 10 | Mint three tokens: **R2 object read/write** (→ Vercel env, the app's), **R2 admin** (→ local `.env` only), **Cloudflare API token scoped Zone → Cache Purge** (→ local `.env` only). 024's checklist steps 5–7, now actually mintable. | `edge.canary.minted`; `ops.cors.matches_repo`; `takedown.purge.landed` |
| 11 | Vercel → project → Settings → Domains: add `xerhero.com` and `www.xerhero.com`. Add the records Vercel shows in Cloudflare DNS **as DNS-only (grey cloud)**. Set `www` → apex redirect, and set the `*.vercel.app` domain to redirect to the apex. | the site's identity; 011's CORS `AllowedOrigins` |
| 12 | Fill `<site-origin>` in `ops/bucket/cors.json` with `https://xerhero.com` and run **`ops bucket apply`** against production. | `edge.cors.preflight`, `edge.robots_txt` |
| 13 | Set the blob-host base URL as an env var in Vercel and in `.env.example` (018), so no hostname is ever a literal in the code. | CI's ability to point the same code at MinIO |
| 14 | **Google Cloud:** create a project, create an OAuth client, verify `xerhero.com` as an authorized domain, publish the consent screen. Clerk production **requires our own credentials** (§1 #16). | Clerk production |
| 15 | **Clerk:** create the production instance for `xerhero.com`, add its DNS records **DNS-only**, paste the Google credentials, swap the app to `pk_live_`/`sk_live_`. | sign-in → upload → 011, 016, 023 |
| 16 | GitHub: branch protection on `main` requiring the CI job, and Actions failure notifications on. 024's steps 9–10; still nothing can assert these. | 024's "deploy-blocking" |

Steps 1–13 are this ticket's. Steps 14–16 are inherited: 14–15 from 010's choice of
Clerk, 16 from 024.

---

## 7. Citation list

Cloudflare — R2 and cache:
- <https://developers.cloudflare.com/r2/buckets/public-buckets/>
- <https://developers.cloudflare.com/r2/pricing/>
- <https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/domains/subresources/managed/>
- <https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/>
- <https://developers.cloudflare.com/cache/how-to/purge-cache/>
- <https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/>
- <https://developers.cloudflare.com/cache/how-to/cache-rules/>
- <https://developers.cloudflare.com/cache/concepts/default-cache-behavior/>
- <https://developers.cloudflare.com/rules/transform/>
- <https://developers.cloudflare.com/rules/transform/response-header-modification/>

Cloudflare — DNS, zones, registrar, Workers:
- <https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/>
- <https://developers.cloudflare.com/dns/zone-setups/partial-setup/>
- <https://developers.cloudflare.com/registrar/faq/>
- <https://developers.cloudflare.com/registrar/get-started/register-domain/>
- <https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/>
- <https://www.cloudflare.com/products/registrar/>
- <https://developers.cloudflare.com/workers/configuration/routing/workers-dev/>
- <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
- <https://developers.cloudflare.com/workers/platform/limits/>

Vercel:
- <https://vercel.com/docs/domains/working-with-domains/add-a-domain>
- <https://vercel.com/docs/domains/set-up-custom-domain>
- <https://vercel.com/docs/plans/hobby>
- <https://vercel.com/guides/using-cloudflare-with-vercel>

Clerk:
- <https://clerk.com/pricing>
- <https://clerk.com/docs/guides/development/deployment/production>
- <https://clerk.com/docs/guides/development/managing-environments>
- <https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google>

Other:
- <https://publicsuffix.org/list/public_suffix_list.dat> (fetched 2026-08-08)
- <https://domainnamewire.com/2026/04/23/breaking-verisign-raising-wholesale-com-prices/>
- <https://hstspreload.org/> and <https://get.dev/> (`.dev` is preloaded HSTS)
