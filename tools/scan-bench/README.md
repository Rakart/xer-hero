# scan-bench

The pre-upload scan, run in **WebKit, Gecko and Blink** against a cap-sized `.xer`.

Built for [029](../../docs/wayfinder/tickets/029-confirm-scan-on-safari.md), which exists
to turn the last reasoned claim in
[020](../../docs/wayfinder/tickets/020-client-parse-budget.md) into a measured one. 020
measured the scan in Chromium only and took the availability of `Blob.stream()`,
`CompressionStream` and `crypto.subtle.digest` from documentation. This harness measures
all three engines and checks the three APIs by **using** them.

Findings: [`safari-gecko-scan.md`](../../docs/wayfinder/tickets/assets/safari-gecko-scan.md).

```bash
node tools/scan-bench/gen-cap-33k.mjs        # the cap-sized fixture, ~50.5 MB
node tools/fixture-gen/generate.mjs --all    # the perf scale points

npm install --prefix tools/scan-bench   # playwright, the harness's only dependency
npx playwright install webkit firefox chromium

node tools/scan-bench/run.mjs                # all three engines, 5 timed repeats
node tools/scan-bench/run.mjs --engines webkit --repeats 3
node tools/scan-bench/report.mjs             # results.json -> the asset's tables
node tools/scan-bench/constrain.mjs          # 020's capped-heap device proxy, per engine
node tools/scan-bench/knob-check.mjs         # ...and whether that proxy's knob bites
node tools/scan-bench/origin-check.mjs       # which origins keep crypto.subtle

node tools/scan-bench/server.mjs 8137        # just serve the page, to poke by hand
```

On a Linux box with no GUI, WebKit needs system libraries Playwright cannot install
without root. If `npx playwright install --with-deps webkit` cannot get root, the
browsers still download and only the host-library validation fails; see the ticket's
Verification section for the unprivileged workaround, and set
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` once the libraries are in place.

| File | What it is |
|---|---|
| `scan.js` | The scan 020 settled on, as a browser ES module. **Not the product parser** — it is the *discarding* driver of 020 §6, and it exists to be measured |
| `bench.html` / `bench.js` | The page. Everything the driver calls hangs off `window.bench` |
| `server.mjs` | Dependency-free static server. `http://localhost` — a secure origin, which `crypto.subtle` requires — plus COOP/COEP so `measureUserAgentSpecificMemory()` is available where the engine has it |
| `run.mjs` | Playwright driver: version, API probes, timed repeats, a memory decomposition, a scale curve and the corpus agreement check |
| `report.mjs` | `results.json` → markdown tables, plus the two agreement checks |
| `constrain.mjs` | 020's device proxy — cap the JS heap per engine and see what dies |
| `knob-check.mjs` | Whether that cap is enforced at all. **Read this before reading `constrain.mjs`'s output** — in two of the three engines the knob is a no-op |
| `origin-check.mjs` | `localhost` vs a LAN IP vs `file://`, per engine. An insecure origin removes `crypto.subtle` and nothing else |
| `gen-cap-33k.mjs` | The 33,000-activity / 50.5 MB fixture, from the same library as the catalogue and without touching it |

## Three things worth knowing before reading a number out of this

**`http://localhost`, never a LAN IP.** `crypto.subtle` is gated on a secure context and
the other two APIs are not, so serving the page from `http://192.168.x.x` does not fail —
it silently removes the content hash and leaves everything else working. Measured in all
three engines by `origin-check.mjs`. `file://` is a secure context too, but it cannot
carry the COOP/COEP headers.

**Memory is reported as growth over the page's own startup high-water mark**, measured
inside one browser instance: `VmHWM` after the run minus `VmHWM` once the page had
loaded and settled. Absolute RSS is not comparable across these builds — three process
topologies and three different amounts of Mesa software-rasteriser mapping, so a
whole-browser figure is mostly floor and the floor is noisy. The delta is a **lower
bound** (a run that peaks below the startup peak reads as zero) and it is the honest
number, because nothing happens between the two readings except the work.

**Only Chromium has an in-page memory instrument.** `performance.memory` and
`performance.measureUserAgentSpecificMemory()` are Chromium-only; WebKit and Gecko
expose neither, which is why the OS-level reading above is the one every engine shares.

## What this cannot answer

**iOS Safari.** It enforces a per-tab ceiling on the whole process, in the OS, and kills
the tab. Desktop WebKit does not have that ceiling, so no run here produces the failure
029 was written about. `constrain.mjs` manufactures the failure *shape* — an engine
killed with nothing catchable — but only in Chromium: `knob-check.mjs` allocates 512 MiB
under a nominal 16 MiB ceiling and finds that `javascript.options.mem.max` (Gecko) and
`JSC_gcMaxHeapSize` (WebKit) are **ignored** in these builds, so those columns say
nothing at all.

**Playwright's WebKit is not Safari.** It is a real WebKit — the same engine source,
built for Linux as WPE — but it is not the binary Apple ships, and it has no
Apple-platform integration. What transfers is engine behaviour: whether the API exists,
whether the algorithm terminates, roughly what it costs. What does not transfer is
anything about iOS.
