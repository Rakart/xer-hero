---
id: 027
title: "Google OAuth in production: the consent screen, the authorized domain, and what review costs"
type: research
status: closed
assignee: carlo
blocked_by: []
---

## Question

What does Google actually require before a stranger can sign in?

Surfaced by [The blob host and the site's domain](025-blob-host-and-domain.md).
[Stack, hosting and auth provider](010-stack-hosting-auth.md) chose Clerk partly on a
contributor-convenience argument — *"Clerk dev instance with shared OAuth credentials — no
Google Cloud project needed"* — and that argument is **true in development and false in
production**. Clerk's own documentation: development instances use preconfigured shared
credentials, but *"for production instances, you must provide custom credentials"*, and the
Google app must be set to the *"In production"* publishing status or end users hit warnings.

Nothing in the effort has costed that. Establish, from Google's own documentation:

- **What publishing an OAuth consent screen actually requires** for the scopes this site uses
  (`openid`, `email`, `profile` — all non-sensitive). Whether that is a self-service state
  change or a review, how long a review takes if there is one, and what triggers one (a logo,
  a brand name, a homepage URL).
- **Authorized domains and domain ownership.** Google requires the authorized domain to be
  verified; establish whether that is Search Console verification, what record it wants, and
  whether it can be done before or only after the domain is live.
- **The unverified-app warning.** Whether a published app with only non-sensitive scopes ever
  shows one, and if so what a planner sees. Under 013's no-warranty posture the site promises
  nothing, but a browser interstitial saying *"Google hasn't verified this app"* on the first
  screen a user meets is a product fact, not a legal one.
- **What the consent screen names.** 003 staked the whole privacy posture on the public
  identity being pseudonymous and 010 removed email from the schema; the consent screen is a
  surface neither of them controls, and it is worth knowing what it says about the site and
  what it tells the site about the user.
- **Whether any of it is a second hosted account with a cost.** A Google Cloud project is
  free, but 019 and 024 both refused fifth vendors on principle, and this would be one more
  console with one more set of credentials in the estate.

The domain ([Register the domain and provision the production estate](026-register-domain-and-provision.md))
is needed to *do* this; it is not needed to *answer* it, so this runs in parallel.

## Resolution

**There is no review. Publishing an OAuth app that asks for nothing but `openid`,
`email` and `profile` is a self-service click with no queue and no fee, there is no
unverified-app interstitial, and neither of Google's two 100-user caps applies —
Google's own app-state table writes our exact scope set into both exceptions.**
What is actually broken without action is not a warning but a **name**: an
unverified consent screen does not say `xer-hero`, it shows a domain, and with
Clerk in the flow that domain is plausibly `clerk.xerhero.com`. So the work this
ticket found is not a review at all. It is a free, automated **brand verification**
that takes minutes, is optional for sign-in, and cannot run until the site is
deployed with a privacy policy.

Full working — thirty verified facts with sources, the four app states, the two
hundreds, and the eleven-step console checklist — is
[in the asset](assets/google-oauth-production.md). Everything was read off a Google
or Clerk page on **2026-08-08**; four claims could not be pinned to a primary source
and are marked **UNVERIFIED** there rather than asserted here.

### The premise inverted, and it inverted twice

This ticket was filed expecting to price a review and an interstitial. Both fears
are wrong, and the sentence that settles it is Google's own:

> *"If your app utilizes only **non-sensitive** scopes, it is not mandatory for your
> app to complete the app verification process."*

Verification is triggered by **sensitive or restricted** scopes — *"Apps that request
access to scopes categorized as sensitive or restricted must complete Google's OAuth
app verification before being granted access"* — and by nothing else. `openid`,
`email` and `profile` are the set Google's own documentation calls *"basic identity
scopes"*, the console classifies scope categories automatically, and this site asks
for no fourth.

Moving Testing → In production is therefore a **state change, not a submission**:
*"Once you select Publish app, your project enters production status"*, after which
the app is *"available to any user with a Google Account."* No approval, no wait, no
fee. Google charges nothing anywhere in this apparatus — *"Google does not charge the
developer any fees for security assessment"* — and the only priced thing in the whole
verification system is a third-party assessor for **restricted** scopes, a path this
site never enters.

The interstitial inverts the same way. The Danger UI reading *"Google hasn't verified
this app"* is attached, verbatim, to scope class rather than to verification status:

> *"Any Google user can access. **Strongly discouraged.** Because the app has not
> completed brand verification, the app's name and logo are not displayed on the
> consent screen. Additionally, **for apps requesting sensitive or restricted
> scopes**, unverified app warnings (Danger UI) will be displayed to users, and a
> hard cap of 100 total users applies."*

Both consequences in that sentence — the warning *and* the 100-user cap — are
conditioned on the same clause. A planner signing in to this site sees a plain
consent screen and no warning, published and unverified.

**The second inversion is that Clerk's own documentation is wrong about this.** Clerk
says switching to production *"involves a verification process with regard to your
app name, logo, and scopes requested before Google accepts the switch to
production."* Google's docs say publishing is unconditional. Clerk's *instruction* —
*"you must set the publishing status to 'In production'"* — is correct and we follow
it; its stated *reason* is not, and 025's flag inherited the error when it wrote that
this needs *"a consent-screen publication whose review requirements … this ticket did
not establish."* There were none to establish.

### The two hundreds do not compound, and the reason is precise

025 found Clerk's development instances capped at 100 users and made that the argument
for a production instance. The obvious worry was that Google's Testing mode carries its
own 100 and that the two would stack. **They do not, and Google's exception names our
scopes literally:**

> *"Only users explicitly added to the test user allowlist can access the app (limited
> to a hard cap of 100 test users). **Exception: If the app only requests basic
> identity scopes (`openid`, `email`, `profile`), any user can access without being on
> the allowlist.**"*

The 7-day refresh-token expiry that travels with Testing mode is exempted on the same
grounds — *"Authorizations by a test user will expire seven days from the time of
consent"*, except *"if your app requests a subset of the following: name, email
address, and user profile."*

So of the four caps in this estate, exactly one binds: **Clerk's**, on a development
instance, where 100 users is not a constraint on anything. Google's Testing cap,
Google's unverified-published cap and Clerk's 50,000 MRU ceiling are all inapplicable
at once.

The oddity this leaves on the record, stated because it is surprising rather than
because it changes anything: **Testing mode would work in production for this site.**
Both of its famous limits are exempted for exactly these scopes. We publish anyway —
because two Google pages contradict each other about whether a testing warning UI still
appears, because brand verification requires *"a published status of Published"*, and
because publishing costs one click and removes a question instead of answering it.

### The defect that is real: the consent screen does not say our name

This is the finding worth the ticket, and it is a product fact rather than a legal one,
exactly as the ticket predicted — just not the fact it predicted.

> *"The app name will be displayed on the OAuth consent screen only if your app has
> been verified."*

An unverified published app is anonymous on its own consent screen. Google documents
that the name and logo are withheld and **does not document what it renders instead**.
For a normal app the substitute would be its own domain and nobody would notice. **For
a Clerk app the two are different strings**, because Clerk deliberately puts the OAuth
callback on its Frontend API subdomain — *"normally hosted on a subdomain like
`https://clerk.yourdomain.com`"* — as a defence against redirect-URI attacks. So the
plausible rendering is `clerk.xerhero.com`: a hostname that appears in no address bar,
in no shared `/p/{slug}` link, and nowhere a user has ever been, on the one screen
whose entire purpose is letting someone check who they are handing their identity to.

Which string Google picks is **UNVERIFIED** and, usefully, does not need to be resolved.

**The decision, made here under the standing preference and stated as a decision:
do the brand verification, and brand the app `xer-hero`.** It is free, it is automated
— *"typically takes a few minutes after you click the Verify Branding button"* — and
its only fallback is a manual review that *"usually takes 2-3 business days"*. Against
that: the first screen a stranger meets either names the site or names a vendor
subdomain, and there is no third option and no way to test which without doing it. The
name matches the repo, the map and every document in this effort; the address bar will
read `xerhero.com` and the consent screen `xer-hero`, differing by a hyphen 025 already
established nobody says out loud. **No logo is uploaded in v1** — 010 removed avatars,
there is no wordmark yet, and the logo field is optional where the name is not.

The consequence for the runway is a sequencing one rather than a cost: **brand
verification cannot run until the site is live.** Google requires the homepage to be
*"Hosted on a verified domain you own"*, *"Visible to users without requiring them to
log-in"*, to *"Fully describe your apps functionality to users"* and to
*"Explain with transparency the purpose for which your app requests user data"*, with
a privacy policy *"hosted within the domain that hosts your homepage."* So it is the
tail of provisioning, not the head — and because sign-in works unverified, it is
**post-launch work that costs a wrong name until it is done**, not a launch blocker.

### The authorized domain is verified before anything serves, and by one specific account

Google's requirement is a Search Console **Domain property**, which is a DNS record and
nothing else:

- *"All domains used in your project, whether in the branding page or client
  configuration pages must be pre-registered here"* — and the OAuth client's redirect
  URI counts as a client configuration page, so `clerk.xerhero.com` puts `xerhero.com`
  in scope even before any homepage exists.
- *"If you have verified the domain with Google, you can use any Top Private Domain as
  an Authorized Domain"*, and *"After adding an authorized domain, you can use any of
  its subdomains or pages"* — so **one** authorized domain covers `clerk.`,
  `accounts.`, `www.` and the apex. 025's one-registrable-domain finding pays a second
  time.
- *"You must verify the Domain Property (DNS-level), rather than a URL prefix or Site
  property"*, which rules out every content-serving method — HTML file, HTML tag,
  Analytics, Tag Manager are all URL-prefix-only. What is left is a TXT record.
- **The answer to the ticket's question is therefore yes, emphatically**: this can be
  done the moment the Cloudflare zone reads Active, with no origin, no deployment and
  no certificate. It slots at 025 **step 4**, not step 14.
- Google also fixes the ordering itself: *"Add your Authorized Domains before you add
  your redirect or origin URIs, your homepage URL, your terms of service URL, or your
  privacy policy URL."*

One constraint nobody would guess: **the same Google account must own both sides.**
*"The domain verification must be performed by a Google account that is currently a
Project Owner of your Google Cloud Project."* That account becomes load-bearing for
sign-in continuity, and the TXT record becomes load-bearing for brand verification —
a zone rebuild that drops it silently un-verifies the domain, and **024's `edge_drift`
cannot catch it**, because an already-verified app keeps working. Both are recorded in
the asset rather than solved; 025's precedent for the domain renewal applies, and this
one has no vendor mail behind it.

### What comes back, and whether `email` was ever optional

For `openid email profile`, exactly: `sub` from `openid`; `email` and `email_verified`
from `email`; `name`, `given_name`, `family_name`, `picture` and `locale` from
`profile`. `sub` is *"An identifier for the user, unique among all Google Accounts and
never reused."*

**Requesting `email` is not optional and dropping it would buy nothing.** Clerk states
*"These essential scopes are pre-configured and automatically included by Clerk"* with
no documented way to remove them, so this is Clerk's ask rather than ours — and Google's
Testing exception is defined over *"name, email address, and user profile"*, the widest
set that qualifies, so narrowing the request moves no limit and removes no warning. The
cost of asking is zero because **010 already made the answer land nowhere**: every one
of those claims stops at Clerk, and `app_user` holds a `clerk_user_id` and a Handle.

The claim that matters more than `email` is **`picture`**. It arrives with `profile`,
`profile` cannot be dropped, and 023 refused Clerk's `<UserButton>` precisely because it
renders the Google profile image that 010 removed on purpose. That refusal was recorded
as a component preference; this ticket makes it structural. **The scope cannot be
narrowed, so the only thing standing between a Google profile image and a page in this
site is the rule that nothing renders `user.imageUrl`.** It should be stated that way.

### Not a second hosted account, and not a cost

The ticket asked whether this is one more console with one more set of credentials, on
the precedent of 019 and 024 refusing fifth vendors. **It is one more console and zero
more credentials in the estate, and the fifth-vendor framing does not apply.**

- **No new vendor is in the request path.** Google is already there — 010 made Google
  sign-in a given and contributors use it today through Clerk's shared client. What
  changes in production is *whose* client id mediates a flow that already runs, not
  whether Google participates.
- **Nothing enters our environment.** The Client ID and Client Secret are pasted into
  **Clerk's dashboard** — the same place 010 already put the Google identity. Not into
  Vercel env vars, not into `.env.example`, not into the repo. 010's argument that the
  Google identity never enters our schema extends cleanly: **the Google credential never
  enters our environment either.** The estate's secret inventory grows by zero values.
- **No money.** Nothing in Google's project, Auth Platform or Sign in with Google
  documentation prices any of this, and no Google Cloud API needs enabling for an OAuth
  flow, so nothing metered is touched. Whether a **billing account** is required at all
  is **UNVERIFIED** — the Free Program page's *"A Google Cloud billing account is
  required to access the Google Cloud Free Tier"* is scoped to consuming billable Cloud
  products, which this does not, and the project-creation doc says only that you *"select
  a billing account as applicable."* It is two minutes of discovery at the console and
  nothing in the plan depends on the answer. 025's `$0/month plus ~$11/year` is unchanged
  either way.

What is genuinely added is **one Google account carrying two roles** (§ above) and one
DNS record that must never be deleted.

### Does this block the domain purchase? No — the purchase blocks all of it

Cleanly separable, and the direction is one-way:

- **Nothing here blocks 026.** No decision in this ticket needs to be revisited after the
  purchase; the name `xerhero.com` is the only input and 025 already chose it.
- **All of it is blocked by the purchase**, and not loosely: the authorized domain must be
  a domain whose DNS the operator controls, which is the same requirement 025 already
  established for Clerk production. There is no partial path — no way to pre-create an
  OAuth client against a hostname that does not exist yet, because the redirect URI's
  domain must be pre-registered and verified first.
- **The one thing that moves earlier than 025 assumed** is Search Console verification,
  which needs the zone (025 step 4) rather than the site (025 step 11).
- **The one thing that moves later** is brand verification, which needs a deployed site
  serving `/privacy` and `/terms`.

### Step 14 is not one step, and it interleaves with step 15

025's asset put the whole of Google behind a single line — *"Google Cloud: create a
project, create an OAuth client, verify `xerhero.com` as an authorized domain, publish the
consent screen"* — in that order, at position 14. Three things are wrong with it, and the
corrected sequence is [in the asset, §8](assets/google-oauth-production.md#8-the-console-checklist--human-only-in-order):
domain verification comes **first**, not third, because the authorized domain must precede
every URI; the OAuth client cannot be created until **Clerk's production instance exists**
and has shown its redirect URI, so 14 and 15 interleave rather than run in order; and
brand verification is a **tail** that runs after 025 step 11 and a production deploy.

Eleven ordered actions, summarised: create the project (no billing, no APIs) → verify
`xerhero.com` as a Search Console **Domain** property with a TXT record in the Cloudflare
zone, from the same Google account → configure the Auth Platform (app name `xer-hero`,
support email, **External**, contact email) → add `xerhero.com` as an authorized domain →
confirm the scope list is exactly the three and all read *Non-sensitive* → **[025 step
15a]** create the Clerk production instance and copy its Authorized Redirect URI →
create the Web-application OAuth client against that URI and save the Client ID and Secret
→ **Publish app** → **[025 step 15b]** paste the credentials into Clerk, enable *Use
custom credentials*, swap to `pk_live_`/`sk_live_` → *(after the site is live)* fill the
app-domain links and click **Verify Branding** → sign in from a signed-out browser and
confirm the screen says `xer-hero`.

**Steps 1–9 are the launch path. Steps 10–11 can happen after launch**, because sign-in
works throughout.

### 010's contributor-convenience argument survives intact — the extension of it did not

010 chose Clerk partly on *"Clerk dev instance with shared OAuth credentials — no Google
Cloud project needed"*, and 025 flagged that as *"true in development and false in
production."* Both halves need correcting, in opposite directions.

**The argument as 010 actually wrote it is about contributors, and it is still true and
always will be.** A contributor at 018's tier 2 needs a Clerk account and a key pair;
Clerk supplies the Google credentials — *"Clerk uses pre-configured, shared credentials to
make the setup process as smooth as possible"* — and no contributor will ever create a
Google Cloud project, verify a domain or see a consent screen we control. 018's four-tier
README contract is unchanged, and the cardless promise is untouched because none of this
needs a card.

**What was false was never stated by 010: that the *operator* also needs no project.**
025 read the convenience argument as a claim about the estate and correctly flagged it.
Priced, the operator's share is: one free console, one TXT record, eleven clicks once, no
recurring cost, no renewal, no second card and no fifth vendor in the request path. That
is a materially smaller bill than 025's flag implied — 025 wrote that this *"means a
Google Cloud project, an OAuth client, a verified authorized domain and a
consent-screen publication whose review requirements … this ticket did not establish",*
and the review requirements turn out to be none.

One thing worth recording for anyone debugging: **the consent screen a contributor sees
in development is Clerk's, not ours.** Nothing observed at tier 2 predicts what a user
sees in production, which is why step 14.11 exists as a separate human check rather than
being assumed from dev.

### What lands on 003's pseudonymity and 013's no-warranty

**003 is confirmed rather than changed, and one of its dependencies hardens.** The consent
screen touches the personal identity and never touches the public one: everything Google
returns stops at Clerk, `app_user` still holds `clerk_user_id` and a Handle, and erasure is
still 010's two acts. The hardening is `picture` — established above as unavoidable, which
converts 023's refusal of `<UserButton>` from a component choice into the only line of
defence.

**003's privacy policy takes a fourth amendment, and this one has an external enforcer.**
Google requires the policy to *"Disclose how your app accesses, uses, stores, or shares
Google user data"* and to be reachable on the verified domain without login. 003 wrote the
policy's personal-data section, 010 rewrote it, 013 added third-party personal data, 017
added the 90-day contact purge — all of them internal decisions. This one is a condition of
the consent screen naming the site, so the policy acquires a reader who is not us.

**013 survives untouched, and it is worth saying why it was never in danger.** Google
demands *description*, not assurance: the homepage must *"Fully describe your apps
functionality"* and *"Explain with transparency the purpose for which your app requests
user data"*, and the ToS is required for external production apps. Describing what a site
does is not warranting that anything on it is correct, and 013's standing decision bans the
second while requiring nothing about the first. No badge, no "checked" state and no
screening promise is implied anywhere in this process.

The tension that *is* real is with **009**, not 013: 009 made the homepage the shelf — a
bare row list under a permanent strap — and Google's brand verification wants a homepage
that describes the app and links a privacy policy. Nobody has ever specified the routes
that render 003's `docs/legal/terms-v1.md` and `docs/legal/privacy-v1.md`, and 023's
closed URL set does not contain them. Filed rather than solved.

### What this hands to other tickets

- **[Stack, hosting and auth provider](010-stack-hosting-auth.md)** — its
  contributor-convenience argument is confirmed for contributors and priced for the
  operator; its Clerk-holds-the-identity argument extends to the Google *credential*;
  and its removal of avatars becomes load-bearing because `picture` cannot be
  un-requested.
- **[The blob host and the site's domain](025-blob-host-and-domain.md)** — its flag is
  answered with *no review, no fee, no interstitial*; its step 14 splits and reorders,
  with domain verification moving to step 4 and brand verification moving past step 11.
- **[Register the domain and provision the production estate](026-register-domain-and-provision.md)** —
  gains eleven ordered sub-steps and the finding that steps 14 and 15 interleave.
- **[Licensing, attribution and takedown](003-licensing-attribution-takedown.md)** — the
  privacy policy gains a Google-user-data disclosure and an external reader; pseudonymity
  is unaffected.
- **[The signed-in user's own space](023-signed-in-users-own-space.md)** — its
  `<UserButton>` refusal is promoted from preference to rule.
- **[Local development and contributor onboarding](018-local-dev-and-onboarding.md)** —
  unchanged, with one note added: the dev consent screen is Clerk's and predicts nothing.

### Flagged

- **The site's public static pages have no owner.** 003 versioned the legal *texts* in the
  repo; nothing has ever fixed the routes that serve them, and 023's closed URL set omits
  them. Google now requires a homepage that describes the app, a privacy policy on the same
  domain and a terms of service, all reachable without login — which makes this the first
  thing in the effort that requires those pages to exist at public URLs. Filed as its own
  ticket.
- **Which domain string an unverified consent screen displays is UNVERIFIED**, and if it is
  the redirect host it is actively misleading. Brand verification makes it moot, which is
  why the decision above is to do it rather than to find out.
- **Whether a billing account is required to create the project at all is UNVERIFIED.**
  Nothing depends on the answer; it is two minutes at the console.
- **Whether the *publish* click itself demands the privacy and terms links is UNVERIFIED.**
  One fetch of Google's Help Center surfaced *"These links are required for all external
  production apps"*; a second fetch of the same URL did not reproduce it. If it is enforced
  at publish time, step 14.8 moves after the deploy and the launch path gets one step
  longer — no other consequence.
- **One Google account is now load-bearing for sign-in continuity**, required by Google to
  be both GCP Project Owner and Search Console verifier. And **the Search Console TXT
  record is load-bearing for brand verification** in a way `edge_drift` cannot see, because
  an already-verified app keeps working after the record disappears.
- **Clerk's own documentation misstates Google's publishing requirements.** Recorded
  because 025's flag inherited the error, and because anyone re-reading Clerk's page later
  will find it says the opposite of this resolution.
