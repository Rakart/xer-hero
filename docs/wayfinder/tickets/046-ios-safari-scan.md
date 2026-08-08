---
id: 046
title: Does mobile Safari survive the cap-sized scan?
type: task
status: out-of-scope
assignee:
blocked_by: []
---

## Question

[The client-side parse budget](020-client-parse-budget.md) declines to build a blind-upload fallback
because the memory failure it was written about is never produced — measured in Chromium, and
confirmed in WebKit and Gecko by [029](029-confirm-scan-on-safari.md), which found all three platform
APIs present and correct by use and the scan completing a 50.5 MB file in **535 ms in WebKit 26.5**,
faster than Blink. **One claim is still reasoned rather than measured: that iOS Safari does not kill
the tab.** iOS enforces a ceiling on a tab's total process memory that no desktop engine reproduces,
and 029 also found that 020's capped-heap device proxy is a **no-op outside Chromium** — so the
"it never produces the condition" argument is evidenced in Blink alone.

**This is HITL and needs an iPhone.** The dev has none. It is filed rather than ruled out of scope
because a handset is easy to borrow and the question is sharp. **Nothing in the map waits on it** —
029's finding moved the residual risk down rather than up.

**Do, on a real iPhone, once**, on a page served over `https://` or a tunnel — **never a plain-http
LAN address**, which removes `crypto.subtle` and nothing else in every engine tested and would
produce a false negative that reads as *"Safari has no WebCrypto"*
([the measurements](assets/safari-gecko-scan.md), §1):

1. Run `tools/scan-bench` against `cap-33k` (33,000 activities / 50.5 MB, regenerable with
   `node tools/scan-bench/gen-cap-33k.mjs`).
2. Record: does the tab survive; wall time; the three API probes.
3. If the tab dies, [020](020-client-parse-budget.md) §4 reopens and the blind-upload fallback it
   declined is back on the table — against [019](019-ingest-observability.md)'s objection, which is
   unchanged.

Ten minutes on a borrowed handset, at £0. Every paid alternative is worse value: a real-device cloud
(free trial, then roughly US$29–39/month) needs the harness on a public URL, which does not exist
until [026](026-register-domain-and-provision.md) is done; and a Mac's iOS Simulator runs the real
engine **without the real memory ceiling**, so it would not settle it either.
