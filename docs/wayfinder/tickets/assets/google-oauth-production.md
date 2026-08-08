# Google OAuth in production — facts, the consent screen, and the console checklist

Working notes for
[Google OAuth in production: the consent screen, the authorized domain, and what review costs](../027-google-oauth-in-production.md).
The decisions are in that ticket's `## Resolution`; this file is the enumerated detail
it links to rather than pastes.

Everything here was checked against a primary source — Google's own documentation or
Clerk's own documentation — on **2026-08-08**. Anything that could not be pinned to a
primary source is marked **UNVERIFIED** rather than asserted. No review timeline and no
fee below is inferred; every number is quoted.

The scopes under test throughout are exactly **`openid`, `email`, `profile`** and
nothing else, because that is the entire set Clerk needs for a Google social connection
and 010 removed every reason to ask for more.

---

## 1. What was verified

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | Apps with **only non-sensitive scopes** must complete verification | **False, and this is the decision-relevant fact.** *"If your app utilizes only **non-sensitive** scopes, it is not mandatory for your app to complete the app verification process."* | [OAuth App Verification Help Center](https://support.google.com/cloud/answer/13463073) |
| 2 | Verification is mandatory for some apps | **True, and not ours.** *"Apps that request access to scopes categorized as **sensitive** or **restricted** must complete Google's OAuth app verification before being granted access."* | [OAuth App Verification Help Center](https://support.google.com/cloud/answer/13463073) |
| 3 | `openid`, `email`, `profile` are non-sensitive | **True.** Google's own app-state table calls them *"basic identity scopes (`openid`, `email`, `profile`)"*; the console classifies automatically — *"When you add scopes to your project, scope categories (non-sensitive, sensitive, or restricted) are indicated automatically in the Google Cloud Console."* | [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [Help Center](https://support.google.com/cloud/answer/13463073) |
| 4 | Moving Testing → In production is a **review** | **False. It is a self-service state change.** *"Once you select **Publish app**, your project enters production status"* and the app becomes *"available to any user with a Google Account."* No approval step, no queue, no wait is documented. | [Manage App Audience](https://support.google.com/cloud/answer/15549945) |
| 5 | A published-but-unverified app shows the "unverified app" interstitial | **False for our scopes.** Verbatim: *"Any Google user can access. **Strongly discouraged.** Because the app has not completed brand verification, the app's name and logo are not displayed on the consent screen. Additionally, **for apps requesting sensitive or restricted scopes**, unverified app warnings (Danger UI) will be displayed to users, and a hard cap of 100 total users applies."* Both consequences are conditioned on sensitive/restricted. | [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) |
| 6 | The 100-user cap on unverified published apps applies to us | **False.** Same sentence as #5 scopes the cap to sensitive/restricted. The FAQ agrees independently: unverified apps *"accessing restricted or sensitive scopes"* face *"a 100 new-user cap restriction"*, and *"if this limit is reached, Google sign-in [is] disabled for your users."* | [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [Verification FAQ](https://support.google.com/cloud/answer/13463817) |
| 7 | What does trigger a review, then | **Two things, and only two.** (a) sensitive or restricted scopes → full verification; (b) wanting an app **name or logo** on the consent screen → *"a lighter-weight verification process known as 'brand-verification'."* Brand verification's own trigger list: user type **External**, published status **Published**, and *"You want your app to display a logo or display name on the OAuth consent screen."* | [Help Center](https://support.google.com/cloud/answer/13463073), [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) |
| 8 | Without brand verification the consent screen still names the app | **False.** *"The app name will be displayed on the OAuth consent screen only if your app has been verified."* And for the logo: *"If your application is external and has the publishing status of production, your app will go through the verification process before your uploaded icon is displayed on the consent screen."* | [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049) |
| 9 | What is shown **instead** of the name | **UNVERIFIED as to the exact string.** Google states only that the name and logo *"are not displayed"* (#5, #8). Search-surfaced snippets of the Help Center say *"only your application domain will be visible to users"*, but a direct fetch of that page on 2026-08-08 did not reproduce the sentence. Which domain — the authorized domain (`xerhero.com`) or the redirect URI's host (`clerk.xerhero.com`) — is documented nowhere reachable. See §4. | — |
| 10 | Brand verification takes a review cycle | **Usually not.** *"The automated brand verification process typically takes a few minutes after you click the Verify Branding button."* Fallback: *"In some cases, where a result cannot be automatically determined, your app may undergo a manual review process that usually takes 2-3 business days."* The FAQ's timetable agrees: Brand Verification **2-3 business days**, Sensitive Scope **10 business days**, Restricted Scope **6 weeks** — with the caveat that *"these estimates are not guaranteed."* | [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [Verification FAQ](https://support.google.com/cloud/answer/13463817) |
| 11 | Any of this costs money | **No.** *"Google does not charge the developer any fees for security assessment."* The only priced thing in the whole verification apparatus is a third-party security assessor, which exists solely for **restricted** scopes: *"The cost for such a service is agreed on between the developer and the assessor without any involvement from Google."* We never enter that path. | [Verification FAQ](https://support.google.com/cloud/answer/13463817) |
| 12 | Authorized domains must be registered in the console | **True, and it covers more fields than the branding page.** *"All domains used in your project, whether in the branding page or client configuration pages must be pre-registered here."* Client configuration pages = the OAuth client's redirect URIs and JavaScript origins. Google also fixes the ordering: *"Add your Authorized Domains before you add your redirect or origin URIs, your homepage URL, your terms of service URL, or your privacy policy URL."* | [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049) |
| 13 | The authorized domain must be **verified**, and where | **True — Google Search Console.** *"If you have verified the domain with Google, you can use any Top Private Domain as an Authorized Domain."* And in the verification requirements: *"You must verify the ownership of your authorized domains using Google Search Console."* | [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049), [Verification requirements](https://support.google.com/cloud/answer/13464321) |
| 14 | Which Search Console property type, and by whom | **Domain property (DNS), by the project owner.** *"You must verify the Domain Property (DNS-level), rather than a URL prefix or Site property."* *"The domain verification must be performed by a Google account that is currently a Project Owner of your Google Cloud Project."* Brand verification restates it: *"A Google Account with owner permissions for a domain must be associated with the API Console project."* | [Domain Verification](https://support.google.com/cloud/answer/13804266), [Submit for brand verification](https://developers.google.com/identity/verification/authentication-verification) |
| 15 | Domain verification can be done before the domain serves anything | **True.** A Domain property is verified by *"Add[ing] a DNS record to your domain provider's record list to prove ownership."* The content-serving methods — HTML file upload, HTML tag, Google Analytics, Google Tag Manager — are all URL-prefix-only and are not the method available here. A TXT record in the Cloudflare zone needs no origin, no deployment and no certificate. | [Verify your site ownership](https://support.google.com/webmasters/answer/9008080) |
| 16 | Only one authorized domain is needed | **True for us.** A Top Private Domain covers its children — *"After adding an authorized domain, you can use any of its subdomains or pages"* — so `xerhero.com` covers `clerk.xerhero.com`, `accounts.xerhero.com` and `www.`. The documented ceiling for verification is **10 authorized domains** (search-surfaced from the same Help Center family; **partially verified**). | [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049) |
| 17 | Brand verification needs pages that actually exist | **True, and this is the sequencing constraint.** The homepage must be *"Hosted on a verified domain you own"*, *"Visible to users without requiring them to log-in to your app"*, must *"Accurately represent and identify you app or brand"*, *"Fully describe your apps functionality to users"*, *"Explain with transparency the purpose for which your app requests user data"*, and carry *"a link to your privacy policy"*. The privacy policy must be *"hosted within the domain that hosts your homepage"* and *"Disclose how your app accesses, uses, stores, or shares Google user data."* | [App Homepage](https://support.google.com/cloud/answer/13807376), [Verification requirements](https://support.google.com/cloud/answer/13464321) |
| 18 | Whether the *publish* click itself requires those links | **UNVERIFIED.** One fetch of the Help Center surfaced *"These links are required for all external production apps"* about the privacy policy and terms of service; a second fetch of the same URL did not reproduce it, and no other page states a publish-time precondition. Treat "publish may demand the links" as possible and cheap to discover — it is one click away. | — |
| 19 | Testing mode caps us at 100 users | **False — there is an explicit exception for exactly our scopes.** *"Only users explicitly added to the test user allowlist can access the app (limited to a hard cap of 100 test users). **Exception: If the app only requests basic identity scopes (`openid`, `email`, `profile`), any user can access without being on the allowlist.**"* | [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) |
| 20 | The 7-day refresh-token expiry bites us | **False, same exception.** *"Authorizations by a test user will expire seven days from the time of consent"* — but *"The only exception to this behavior is if your app requests a subset of the following: name, email address, and user profile"*, or uses Sign in with Google for authentication, in which case users avoid the warning and authorizations do not expire after 7 days. | [Manage App Audience](https://support.google.com/cloud/answer/15549945) |
| 21 | Testing mode shows *some* warning | **The two pages disagree.** The app-state overview says testing users *"see a warning UI indicating the app is in testing, rather than the standard unverified app screen"*, with the scope exception attached only to the allowlist. Manage App Audience says the name/email/profile exception means *users avoid the warning*. Unresolved in Google's own docs; the resolution sidesteps it by publishing. | both, above |
| 22 | What claims come back for `openid email profile` | **Exactly these.** `openid` → `sub`; `email` → `email`, `email_verified`; `profile` → `name`, `given_name`, `family_name`, `picture`, `locale`. `sub` is *"An identifier for the user, unique among all Google Accounts and never reused."* Note `picture` — a profile-image URL — arrives whether or not anything renders it. | [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) |
| 23 | `email` could be dropped to narrow the ask | **No, and dropping it would buy nothing anyway.** Clerk: *"These essential scopes are pre-configured and automatically included by Clerk"*, with no documented way to remove them. And Google's Testing-mode exception (#19, #20) is defined over *"name, email address, and user profile"* — the widest set that qualifies — so asking for less moves nothing. | [Clerk social connections](https://clerk.com/docs/nextjs/guides/configure/auth-strategies/social-connections/overview), [Manage App Audience](https://support.google.com/cloud/answer/15549945) |
| 24 | Clerk production needs our own Google client | **True** (025 already established this). *"For production instances, you need to configure the provider with custom OAuth credentials"*; in development *"Clerk uses pre-configured, shared credentials to make the setup process as smooth as possible."* And *"You are required to provision your own SSO credentials."* | [Clerk social connections](https://clerk.com/docs/nextjs/guides/configure/auth-strategies/social-connections/overview), [Managing environments](https://clerk.com/docs/guides/development/managing-environments) |
| 25 | Clerk's own doc describes the publish step correctly | **No — Clerk overstates it.** Clerk says switching to production *"involves a verification process with regard to your app name, logo, and scopes requested before Google accepts the switch to production."* Google's own docs (#1, #4, #5) say publishing is unconditional and verification is optional for non-sensitive scopes. Clerk's instruction — *"you must set the publishing status to 'In production'"* — is right; its reason is wrong. | [Clerk Google connection](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) |
| 26 | Where the redirect URI lives | **On Clerk's Frontend API subdomain.** Clerk *"forces developers to set the OAuth `redirect_uri` to be an endpoint on their API, which is normally hosted on a subdomain like `https://clerk.yourdomain.com`."* The exact value is read off the Clerk Dashboard after the production instance exists. | [Clerk](https://clerk.com/blog/open-response-type-vulnerability), [Clerk Google connection](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) |
| 27 | Clerk development instances cap at 100 users | **True** (025). *"Development instances are capped at 100 users, and user data can not be transferred between instances."* This is **Clerk's** cap, unrelated to Google's — see §5. | [Managing environments](https://clerk.com/docs/guides/development/managing-environments) |
| 28 | A Google Cloud project costs money | **No documented charge.** Nothing in the project-creation, Auth Platform or Sign in with Google documentation prices any of it; the Sign in with Google overview mentions no charge of any kind. No Google Cloud **API** needs enabling for an OAuth sign-in flow, so nothing metered is touched. | [Creating and managing projects](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects), [Sign in with Google overview](https://developers.google.com/identity/gsi/web/guides/overview) |
| 29 | A billing account is required | **UNVERIFIED, and probably not.** The Google Cloud **Free Program** page says *"A Google Cloud billing account is required to access the Google Cloud Free Tier"* — but that page is scoped to consuming billable Cloud products, which this does not. The project-creation doc says only that you *"select a billing account as applicable"*. No page states a billing account is required to create a project or an OAuth client. Discoverable in two minutes at the console; budget nothing for it. | [Free Cloud features](https://docs.cloud.google.com/free/docs/free-cloud-features), [Creating and managing projects](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects) |
| 30 | Logo constraints, if one is ever supplied | *"Image should be square and 120px by 120px for the best display results"*, not exceeding 1 MB, in JPG, PNG or BMP. | [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049) |

---

## 2. The four app states, and which one we are in

Google's own table, reproduced from the
[OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview):

| Publishing status | User type | Test users | Verification | What it means |
|---|---|---|---|---|
| N/A | Internal | No | N/A | Workspace-org only. Not available to us — there is no org. |
| Testing | External | Yes | N/A | 100-user allowlist cap, **except for `openid email profile`, where any user can access without being on the allowlist**. 7-day authorization expiry, **except for name/email/profile**. |
| Published | External | No | Unverified | Any Google user. Name and logo **not** shown. Danger UI and the 100-total-user cap apply **only to sensitive/restricted scope apps**. |
| Published | External | No | Verified | Any Google user. Name, logo and scopes shown, no warnings. |

**The state we ship in is row 4** — Published / External / Verified, where "verified" means
*brand*-verified only, the lightweight automated kind, because we never request a scope
that needs the other kind.

**The surprise in row 2:** an app requesting only `openid email profile` is not actually
constrained by Testing mode at all. Both of Testing's famous limits — the 100-user
allowlist and the 7-day refresh-token expiry — carry an explicit exception for exactly
these scopes. Testing mode would technically work in production for this site. We publish
anyway, for the reason in §6.

---

## 3. What the user actually sees, in the three possible states

| State | Consent screen names the app | Interstitial before consent | User cap |
|---|---|---|---|
| Testing, `openid email profile` | no (unverified) | **disputed** — the overview page says a testing warning UI; the Audience page says the exception avoids it | none for these scopes |
| Published, unverified | **no — a domain string instead (§1 #9)** | **no** — Danger UI is conditioned on sensitive/restricted scopes | none for these scopes |
| Published, brand-verified | **yes — app name, and logo if supplied** | no | none |

**The interstitial this ticket was filed to price does not exist for us.** *"Google hasn't
verified this app"* is the sensitive/restricted-scope screen, and Google's app-state table
attaches it to those scopes explicitly. A planner signing in with Google to a published
app that asks for nothing but their identity sees a plain consent screen and no warning.

**What is wrong instead is the name.** Without brand verification the screen does not say
`xer-hero`; it says a domain. That is a smaller defect than an interstitial and a more
insidious one, because it does not look like an error — it looks like the site is called
something the user has never heard of.

---

## 4. Which domain string, and why it matters more here than it usually would

Google documents that the name and logo are withheld; it does not document what it renders
in their place. The two candidates are the authorized domain (`xerhero.com`) and the
redirect URI's host.

For a normal app those are the same string. **For a Clerk app they are not.** Clerk
deliberately puts the OAuth callback on its own Frontend API subdomain — *"normally hosted
on a subdomain like `https://clerk.yourdomain.com`"* — as a defence against redirect-URI
attacks. So the redirect host is `clerk.xerhero.com`, a hostname that appears nowhere in
the address bar, nowhere in a shared `/p/{slug}` link, and nowhere a user has ever been.

If Google renders the redirect host, the first screen a stranger meets on this site says
they are signing in to **`clerk.xerhero.com`** — a vendor-shaped subdomain of a domain they
have just learned to trust, on the one screen whose entire job is to let them check they
are handing their identity to who they think they are.

This is **UNVERIFIED** — Google does not document the substitution — and it is the strongest
single argument for spending the few minutes on brand verification, because brand
verification makes the question moot rather than answered.

---

## 5. The two hundreds do not compound

Two separate 100-user caps are in play in this estate and it is worth being explicit that
they never multiply:

| Cap | Whose | Binds when | Binds us |
|---|---|---|---|
| Clerk development instance, 100 users | **Clerk's** | any dev instance, always | only a contributor's own dev instance, where 100 users is not a constraint |
| Google Testing-mode test-user allowlist, 100 | **Google's** | Testing status | **no** — explicit exception for `openid email profile` (§1 #19) |
| Google unverified-published total-user cap, 100 | **Google's** | Published + Unverified + **sensitive/restricted scopes** | **no** — we request neither (§1 #6) |
| Clerk free plan, 50,000 MRU | **Clerk's** | production | not at this scale (010) |

025 flagged Clerk's 100-user development cap as the thing that makes a production instance
necessary. It is — but it is the *only* hundred that ever applies here. Google's two both
have our exact scope set written into their exceptions.

---

## 6. Why publish anyway, given Testing would work

Three reasons, in order of weight:

1. **The docs contradict each other about the testing warning** (§1 #21). Publishing
   removes a question rather than answering it, for the price of one click.
2. **Brand verification requires Published status.** Its trigger list is *"user type of
   External and a published status of Published"* — so staying in Testing forecloses ever
   naming the app on the consent screen.
3. **Clerk instructs it**: *"Ensure that your Clerk production app always uses a
   corresponding Google OAuth app that is set to the 'In production' publishing status, so
   your end users don't encounter any issues."* Clerk's stated *reason* is wrong (§1 #25);
   its instruction is still the one to follow.

Publishing costs nothing, waits for nothing, and is reversible.

---

## 7. What lands in the estate

| Artefact | Where it lives | Secret? | Notes |
|---|---|---|---|
| Google Cloud project | console.cloud.google.com, on the operator's existing Google account | no | no billing account attached, no API enabled |
| Google Auth Platform config (branding, audience, scopes) | same project | no | one app name, one support email, one contact email |
| OAuth **Client ID** | Google console → **pasted into Clerk Dashboard** | no (it appears in the authorization URL) | |
| OAuth **Client Secret** | Google console → **pasted into Clerk Dashboard** | **yes** | |
| Search Console Domain property for `xerhero.com` | search.google.com/search-console, same Google account | no | one TXT record, permanent |
| A TXT record in the Cloudflare zone | Cloudflare DNS | no | must not be deleted; Search Console re-checks |

**Nothing enters Vercel's environment, `.env.example`, or the repo.** The client secret's
only home is Clerk's dashboard — the same place 010 already put the Google identity. The
estate's secret inventory does not grow by a single value; it grows by one console and one
DNS record.

Two single points of failure are created and are worth recording rather than solving:

- **One Google account is now load-bearing for sign-in continuity.** It must be a Project
  Owner of the GCP project *and* the verifier of the Search Console property (§1 #14) —
  Google requires them to be the same account. Losing it does not break a running
  instance, but it makes the OAuth client unmanageable.
- **The Cloudflare TXT record is now load-bearing for brand verification.** A zone rebuild
  that drops it silently un-verifies the domain. It is not an assertion 024's `edge_drift`
  can catch, because an already-verified app keeps working.

---

## 8. The console checklist — human-only, in order

This replaces step 14 of
[025's sixteen-step checklist](blob-host-and-domain.md#6-the-provisioning-checklist--human-only-in-order).
The material finding is that **step 14 is not one step and does not sit where it was
placed**: its front half can run as soon as the Cloudflare zone is Active (025 step 4), its
middle interleaves with step 15 rather than preceding it, and its tail cannot run until the
site is deployed and serving `/privacy` and `/terms`.

| # | Step | Prerequisite | Unblocks |
|---|---|---|---|
| 14.1 | Sign in to the **Google Cloud console** with the account that will own this permanently, and **create a project** (`xer-hero`). Attach no billing account. Enable no API. | a Google account | everything below |
| 14.2 | **Google Search Console → Add property → Domain** → `xerhero.com`. Copy the TXT record, add it in the Cloudflare zone, click Verify. Must be the **same Google account** as 14.1 (§1 #14), and must be the **Domain** property, not URL-prefix. | 025 step 4 (zone Active). **Not** a live site. | 14.4 |
| 14.3 | **Google Auth Platform → Get started.** App name **`xer-hero`**, user support email, Audience **External**, developer contact email, accept the User Data Policy. | 14.1 | 14.4 |
| 14.4 | **Branding → Authorized domains → add `xerhero.com`.** Do this *before* any URI is entered anywhere — Google fixes that ordering itself (§1 #12). | 14.2, 14.3 | 14.7 |
| 14.5 | **Data access →** confirm the scope list is exactly `openid`, `email`, `profile` and that all three read **Non-sensitive**. Add nothing. Anything sensitive here converts this ticket's answer into a 10-business-day review. | 14.3 | the whole no-review finding |
| 14.6 | **Clerk → create the production instance for `xerhero.com`**, add its DNS records **DNS-only** (025), and copy the **Authorized Redirect URI** it shows. *(This is the first half of 025 step 15, and it has to happen here.)* | 025 steps 3–4 | 14.7 |
| 14.7 | **Clients → Create OAuth client → Web application.** Authorized JavaScript origin `https://xerhero.com`; Authorized redirect URI = the value from 14.6. Save the **Client ID** and **Client Secret**. | 14.4, 14.6 | 14.9 |
| 14.8 | **Audience → Publish app.** Confirm it reads *In production*. No review, no queue, no wait (§1 #4). | 14.7 | 14.10 |
| 14.9 | **Clerk → Google connection →** enable *Use custom credentials*, paste the Client ID and Secret, and swap the app to `pk_live_`/`sk_live_`. *(Second half of 025 step 15.)* | 14.7, 14.8 | sign-in → presign → upload → 011, 016, 023 |
| 14.10 | **After 025 step 11 and a production deploy that serves `/privacy` and `/terms` on the apex:** Branding → App domain → home page `https://xerhero.com`, privacy policy, terms of service. Optional 120×120 logo. Click **Verify Branding**. Minutes if automated, 2–3 business days if it goes manual (§1 #10). | a live site with legal pages | the consent screen naming `xer-hero` |
| 14.11 | From a **signed-out** browser, run a real sign-in and read the consent screen. It must say `xer-hero`, not a hostname. | 14.10 | nothing — this is the verification |

**Steps 14.1–14.9 are the launch path. Steps 14.10–14.11 are cosmetic-but-material and
can happen after launch**, because sign-in works throughout — an unverified published app
with these scopes has no cap, no warning and no expiry (§3). Nothing here needs to be done
before the domain is bought, and nothing here can be done before it.

---

## 9. Citation list

Google — OAuth app state, verification and publishing:
- <https://developers.google.com/identity/protocols/oauth2/production-readiness/overview>
- <https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification>
- <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification>
- <https://developers.google.com/identity/protocols/oauth2/policies>
- <https://developers.google.com/identity/verification/authentication-verification>
- <https://support.google.com/cloud/answer/13463073> (OAuth App Verification Help Center)
- <https://support.google.com/cloud/answer/13463817> (verification FAQ — timelines, fees)
- <https://support.google.com/cloud/answer/13464321> (verification requirements)
- <https://support.google.com/cloud/answer/7454865> (unverified apps)

Google — console configuration:
- <https://support.google.com/cloud/answer/15544987> (get started with the Google Auth Platform)
- <https://support.google.com/cloud/answer/15549945> (Manage App Audience — publishing status, test users, 7-day expiry)
- <https://support.google.com/cloud/answer/15549049> (Manage OAuth App Branding — name, logo, app domain, authorized domains)
- <https://support.google.com/cloud/answer/13807376> (App Homepage requirements)
- <https://support.google.com/cloud/answer/13804266> (Domain Verification)
- <https://support.google.com/cloud/answer/6158849> (Manage OAuth Clients)
- <https://developers.google.com/workspace/guides/configure-oauth-consent>

Google — identity, domains, cost:
- <https://developers.google.com/identity/openid-connect/openid-connect> (scopes → claims)
- <https://developers.google.com/identity/gsi/web/guides/overview>
- <https://support.google.com/webmasters/answer/9008080> (Search Console verification methods)
- <https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects>
- <https://docs.cloud.google.com/free/docs/free-cloud-features>

Clerk:
- <https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google>
- <https://clerk.com/docs/nextjs/guides/configure/auth-strategies/social-connections/overview>
- <https://clerk.com/docs/guides/development/managing-environments>
- <https://clerk.com/docs/guides/development/deployment/production>
- <https://clerk.com/blog/open-response-type-vulnerability> (redirect URI on `clerk.yourdomain.com`)
