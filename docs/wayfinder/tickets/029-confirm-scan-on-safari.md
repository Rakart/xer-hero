---
id: 029
title: Confirm the pre-upload scan on mobile Safari
type: task
status: closed
assignee: carlo
blocked_by: [020]
---

## Question

[The client-side parse budget](020-client-parse-budget.md) settled the pre-upload pass
as a streaming scan and measured it in **Chromium only** — Firefox and WebKit were not
available on the machine that resolved it, so no figure in that ticket is a Safari
figure. The ticket's original worry was specifically **mobile Safari**, which kills the
tab rather than throwing something catchable, and that worry is neither confirmed nor
refuted.

The decision does not wait on this: the scan retains ~3 MB flat and completes a 50.5 MB
file inside a 16 MB V8 old space, and a design that fits in 16 MB is not expected to
have a Safari question. This ticket exists so the last reasoned claim in 020 becomes a
measured one.

This is a HITL task for whoever has the hardware in front of them.

**Do, on real hardware, once:**

- Load the upload page (or a standalone harness) on **iOS Safari** and on **desktop
  Safari**, and run the scan against a cap-sized `.xer` — 33,000 activities / ~50 MB,
  reproducible from `tools/fixture-gen`.
- Record: does it complete, wall time, and `performance.measureUserAgentSpecificMemory()`
  if available (Safari does not expose `performance.memory`).
- Confirm the three platform APIs the upload page requires are present:
  `Blob.stream()`, `CompressionStream`, `crypto.subtle.digest`. 020 took their
  availability from documentation rather than measurement.
- Repeat on **Firefox**, which is the other engine 020 could not reach.

If the scan does not complete on any of them, that is a real finding and reopens 020's
section 4 — which currently states that the failure condition is never produced, and
declines to build a blind-upload fallback on the grounds that one would cost 019 its
sharpest alarm.

### Re-scoped 2026-08-08: there is no Apple hardware, and two of the three questions do not need any

The dev has no iOS device and no Mac, so "wait for hardware" was the whole plan and the
plan had no date on it. The ticket splits into three questions, and **two of them are
engine questions rather than device questions** — Playwright's WebKit and Firefox builds
are the real engines, so they are answerable on the Linux box today:

- **(a) Are the three APIs there in WebKit and in Gecko?** Answerable. 020 took them
  from documentation.
- **(b) Does the scan complete, and at what cost?** Answerable, with the caveat that
  Playwright's WebKit is not byte-identical to the WebKit Apple ships.
- **(c) Does mobile Safari kill the tab?** **Not** answerable. iOS enforces a per-tab
  ceiling on total process memory that no desktop engine reproduces.

(a) and (b) are resolved below. (c) is not, and is not fudged.

## Resolution

**The three APIs are present and correct in WebKit and in Gecko, checked by using them
rather than by asking documentation, and the scan completes on a 50.5 MB `.xer` in both
— fastest of the three engines in WebKit, at 535 ms against Blink's 634 ms.** Two of the
ticket's three questions are now measured. The third, **whether mobile Safari kills the
tab, is not measured and cannot be measured on this machine at any price**, because iOS
enforces a ceiling on a tab's total process memory that no desktop engine has.

All figures, the harness description and the full tables are in
[the measurements](assets/safari-gecko-scan.md). Measured **2026-08-08** against
**WebKit 26.5** (Playwright `webkit-2336`, WPE headless, UA `Version/26.5
Safari/605.1.15`), **Firefox 153.0**, and **Chrome Headless Shell 151.0.7922.34** as the
control, on the regenerated 50,545,971-byte `cap-33k`.

| | WebKit 26.5 | Gecko 153 | Blink 151 (control) | 020 (Chrome 149) |
|---|---|---|---|---|
| `Blob.stream()` | **yes**, by use | **yes** | yes | documented |
| `CompressionStream` | **yes**, gzip magic checked | **yes** | yes | documented |
| `crypto.subtle.digest` | **yes**, checked against a published vector | **yes** | yes | documented |
| Completes on 50.5 MB | **5/5** | **5/5** | 5/5 | yes |
| Wall, median of 5 | **535 ms** | **678 ms** | 634 ms | 661 ms |
| Peak process growth | **360 MiB** | **190 MiB** | 234 MiB | 214.5 MiB renderer RSS |
| Peak JS heap | *no instrument* | *no instrument* | 139 MiB | 73.8 MiB |
| Agrees with 012's goldens | **27/27** | **27/27** | 27/27 | 23/23 |

**020's section 4 is confirmed, not reopened.** Nothing failed. The failure condition it
declines to build a fallback for was not produced in any engine, and the platform-API gate
it substituted for a fallback is real in all three.

### 1. The APIs: nothing missing, nothing subtly wrong

Each API is exercised and its **output checked**, because an API that is present and
wrong is worse than one that is absent — the digest is 011's duplicate check and the gzip
is what R2 receives. `crypto.subtle.digest` returns the published SHA-256 of `"abc"` in
all three engines; `CompressionStream('gzip')` emits output beginning `1f 8b` in all
three, which rules out the failure where an engine accepts `'gzip'` and produces bare
deflate — an object R2 would store happily and ingest could not read.

020's documentary claim holds in both engines it could not reach. `TextDecoder`'s
`windows-1252` label is present and correct in all three too, verified by decoding `0x97`
to an em dash rather than to U+0097, which is the part of CP1252 that is not Latin-1 and
the thing 002 warned about.

**One finding that is operationally sharper than any of that**: an insecure origin
removes `crypto.subtle` and **nothing else**, in every engine. Over `http://<LAN IP>`,
`Blob.stream()` and `CompressionStream` both work and the hash is gone. That is precisely
the trap waiting for whoever finally runs this on a borrowed iPhone by serving the page
off the laptop's LAN address — it reads as *"Safari has no WebCrypto"* and produces a
false negative on the exact question. `file://` and `http://localhost` are both secure
contexts; a LAN address is not.

### 2. It completes, and WebKit is the fastest of the three

Five repeats per engine, each in a fresh browser process: WebKit **512 / 535 / 614 ms**
(min/median/max), Gecko 661 / 678 / 686, Blink 630 / 634 / 647. Linear in file size from
3.3 MB to 50.5 MB in all three, with no knee. The Blink control lands within 4% of 020's
661 ms on a different Chrome major and a rebuilt harness, which is what says this harness
measures what 020 measured.

**The scan gives the same answers in all three engines, and they are the right answers.**
The serialised `ScanResult` is **byte-identical across WebKit, Gecko and Blink on 27/27
corpus fixtures**, and **27/27 agree with 012's goldens** — including 011's discriminator
(`multiproj-two-proj-id` reports 2 distinct `TASK.proj_id`, `multiproj-baseline-rows`
reports 1 across 3 `PROJECT` rows) and 040's readability guard, which had never run
outside Chromium and reports `reaches_end_marker: false` with the goldens' exact NUL
counts on both damaged files. `cap-33k`'s content hash is the same string from WebKit,
Gecko, Blink and Node.

**Memory is the weakest half of this and is reported as such.** Neither WebKit nor Gecko
exposes `performance.memory`, and `performance.measureUserAgentSpecificMemory()` is
absent in both and throws in this Blink build — so 020's "3 MB retained, flat" is not
reproduced in any engine here, and not contradicted either. The one reading every engine
shares is OS process growth over the page's own startup high-water mark: **WebKit 360
MiB, Gecko 190 MiB, Blink 234 MiB**. Most of WebKit's is the harness rather than the
scan: fetching the file into a `Blob` over HTTP costs WebKit **5.6× the file** against
Blink's 1.03×, and the real upload page gets its `File` from a picker, which is
disk-backed and costs nothing. That 5.6× is worth remembering anywhere the product ever
fetches a `.xer` into a Blob — nothing in 011's flow does, but a fork-and-re-upload
affordance would.

### 3. 020's device proxy is Chromium-only, and that is a correction to 020's method

020 §3's argument rests on a capped V8 old space as a stand-in for a constrained device.
The same was attempted per engine — `javascript.options.mem.max` in Gecko,
`JSC_gcMaxHeapSize` in WebKit — and then, before any of it was read, **the knob itself
was tested**: set a 16 MiB ceiling, allocate 512 MiB of live strings.

| Engine | Knob | Result |
|---|---|---|
| Blink | `--js-flags=--max-old-space-size` | **died, uncatchably — the knob bites** |
| Gecko | `javascript.options.mem.max` | **survived — the knob is a no-op** |
| WebKit | `JSC_gcMaxHeapSize` | **survived — the knob is a no-op** |

So the WebKit and Gecko constrained runs are **void**: "survives an 8 MiB heap" and "the
flag was ignored" are indistinguishable from the scan's output, and the check says it is
the second. Reporting them as evidence of frugality would have been the most tempting
wrong thing in this ticket.

The Blink rows reproduce 020 §3 and extend it, on the same tokenizer with both drivers:
**the full client step survives a 16 MiB old space on a 50.5 MB file and dies at 8 MiB;
the retaining full parse of the same file survives 512 MiB and dies at 256.** 020
measured the parse dying at 64 MiB on the 30.7 MB `perf-20k`. The gap between the two
drivers is at least **16×**, and 020's central claim — that the scan wins by never
producing the condition — remains evidenced **in Blink alone**.

### 4. A hardening note of 020's stops being prudent and becomes required

Not a question this ticket asked. `CompressionStream('gzip')` over the identical file
produces **three different lengths**: WebKit 7,383,836, Gecko 7,192,108, Blink 7,155,680
— a 228 KB spread, with Blink's matching Node's default `zlib.gzipSync` exactly. **Gecko
is not even deterministic across runs**: one of five came out 235 bytes longer, which is
stream chunk boundaries landing differently against deflate's block flushing.

020 already requires presign to issue an **exact** content-length because R2 rejects
anything else. This supplies a second and independent reason: **the compressed length is
not a function of the file.** It cannot be predicted server-side, from another engine, or
in Gecko from the same engine's previous answer. It also puts one condition on retry that
nothing has stated — **a retry must PUT the same blob, or fetch a new presigned URL** —
because re-gzipping to retry can produce a length the presigned URL rejects. 020 retains
the blob, so the design as decided is correct; what changes is that retaining it is
load-bearing rather than an optimisation.

### 5. What remains unmeasured, and what would settle it

- **iOS Safari: not measured, and not measurable here at any effort.** iOS kills a tab
  that exceeds a per-process ceiling the OS enforces, and nothing on a Linux desktop
  reproduces that. **No figure in this ticket is an iOS figure**, and the ticket's
  central worry is still neither confirmed nor refuted.
- **Playwright's WebKit is not Safari.** Same engine source, built for Linux as WPE, at a
  revision reporting `Version/26.5`. A far better witness than documentation; not
  byte-identical to Apple's binary, and with the Linux port's libraries behind
  `CompressionStream` and `crypto.subtle`.
- **Desktop Safari: not measured.** It needs a Mac, and it is the less interesting half —
  a desktop tab has memory.
- **No real device.** Every wall time here is a 16-vCPU desktop's.
- **Retained memory after settling.** No instrument in WebKit or Gecko.

The instrument that would answer (c) is **a borrowed iPhone for ten minutes**, at £0:
open the harness over `https://` or a tunnel — *not* a LAN address, per §1 — run one
50 MB file, read the API probes and the wall time off the page. Every paid alternative is
worse value: a real-device cloud (BrowserStack Live and equivalents, free trial then
roughly US$29–39/month, figures approximate and worth rechecking) needs the harness on a
public URL, which does not exist until
[026](026-register-domain-and-provision.md) is done; a Mac at ~£600 buys desktop Safari
and an iOS Simulator that runs the real engine **without the real memory ceiling**, so it
would still not settle it.

### Closing

Closed on the re-scope above. Three of this ticket's four bullets are done and the fourth
is not a smaller version of them: this ticket was blocked on reasoned-versus-measured and
is unblocked, while what is left is blocked on hardware nobody has, which no amount of
agent time moves. Filed as
[Does mobile Safari survive the cap-sized scan?](046-ios-safari-scan.md) — ten minutes on
a borrowed handset, and the one thing this ticket found that makes it worth filing rather
than waving through is §3: 020's *"the remedy wins by never producing the condition"* is
evidenced in Blink alone.

The harness is committed as `tools/scan-bench/`, which 020's was not. It is the only part
of this repo with a third-party dependency (`playwright`, scoped to its own
`package.json`); `tools/fixture-gen` keeps its Node-and-nothing-else promise.
