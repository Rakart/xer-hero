// The pre-upload scan, as 020 settled it — a browser ES module, no build step.
//
// This is a BENCH-FAITHFUL implementation of the scan 020 decided on, written so the
// three platform APIs it names are exercised for real rather than feature-detected:
//
//   Blob.stream()          the file is read as a byte stream, never as one string
//   crypto.subtle.digest   the content hash, over the file's bytes (020 §4: WebCrypto,
//                          not a hand-rolled streaming SHA-256)
//   CompressionStream      010's gzip for the PUT, over the same read
//
// It is NOT the product parser. It is the shape 020 §6 settled on — **one tokenizer,
// two drivers** — so that the thing being measured has the seam the decision depends
// on. `tokenize()` owns the %T/%F/%R grammar, the per-file per-table name→index
// mapping, the CP1252 decode and the continuation-line rule. `scanDriver` discards;
// `parseDriver` retains. The second exists because 020's whole argument is a comparison
// between them, and a comparison needs both halves measured on the same tokenizer.

const LIST_CAP = 500;      // 020: 13x the worst real file, so a pathological export
const USER_SET_CAP = 64;   //      cannot make the panel unbounded
const NOTE_CHARS = 120;
const MEMO_CHARS = 200;

/**
 * Columns the scan wants, per table. Everything not named here is counted and thrown
 * away without the row being split at all — which is two thirds of the records in a
 * real export, because the tables that make a `.xer` big are the tables the pre-upload
 * screen has no use for.
 *
 * Field indices are resolved per table PER FILE from the %F header (002's rule), never
 * by position.
 */
const WANTED = {
  PROJECT: ['proj_id', 'proj_short_name', 'proj_name', 'last_recalc_date', 'add_by_name'],
  PROJWBS: ['wbs_id', 'parent_wbs_id', 'wbs_name', 'proj_node_flag'],
  TASK: ['proj_id', 'status_code', 'task_type', 'create_user', 'update_user',
    'early_start_date', 'early_end_date', 'act_start_date', 'act_end_date',
    'target_start_date', 'target_end_date'],
  RSRC: ['rsrc_name', 'rsrc_type', 'rsrc_notes', 'email_addr', 'office_phone',
    'other_phone', 'employee_code', 'user_id'],
  TASKMEMO: ['task_memo'],
  UDFTYPE: ['udf_type_id', 'udf_type_label', 'table_name'],
  UDFVALUE: ['udf_type_id'],
  TASKUSER: ['user_id'],
  DOCUMENT: ['author_name'],
};

// CP1252's 0x80-0x9F block — the part that is NOT Latin-1. TextDecoder does this for us
// where 'windows-1252' is supported, which is every engine under test; the table is the
// fallback and the statement of intent.
const CP1252_HIGH = '€‚ƒ„…†‡ˆ‰Š'
  + '‹ŒŽ‘’“”•–—'
  + '˜™š›œžŸ';

function decodeCp1252(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += b >= 0x80 && b <= 0x9F ? CP1252_HIGH[b - 0x80] : String.fromCharCode(b);
  }
  return out;
}

function makeDecoder() {
  try {
    const d = new TextDecoder('windows-1252');
    // Prove it really is CP1252 and not a silent fall-through to UTF-8 or Latin-1:
    // 0x97 must decode to an em dash, not to U+0097.
    if (d.decode(new Uint8Array([0x97])) !== '—') throw new Error('not cp1252');
    return { name: 'TextDecoder(windows-1252)', decode: (b, stream) => d.decode(b, { stream }) };
  } catch {
    return { name: 'hand-rolled cp1252 table', decode: (b) => decodeCp1252(b) };
  }
}

/** A bounded list. Past the cap it counts and stops keeping. */
class Capped {
  constructor(cap) { this.cap = cap; this.values = []; this.seen = 0; }
  push(v) { this.seen++; if (this.values.length < this.cap) this.values.push(v); }
  toJSON() { return { kept: this.values.length, seen: this.seen, capped: this.seen > this.cap }; }
}

// ---- the tokenizer ----------------------------------------------------------

/**
 * The one module 020 §6 says has to stay one module. Reads a byte stream, emits records
 * to a driver, retains nothing of its own beyond the current line.
 *
 * A driver supplies:
 *   wants(table)   -> null (do not split this row at all)
 *                   | 'all' (split every field)
 *                   | [names] (slice only these columns)
 *   row(table, obj) obj is null where wants() said null
 *   ermhdr(line), table(name), end()
 *
 * The byte facts 040 needs — `reaches_end_marker` and `nul_byte_count` — are counted
 * here rather than in a driver, because they are properties of the bytes and both
 * drivers need them.
 */
export async function tokenize(streamOrFile, driver) {
  const decoder = makeDecoder();
  const reader = (streamOrFile.stream ? streamOrFile.stream() : streamOrFile).getReader();

  const bytes = { total: 0, nul: 0 };
  let reachesEnd = false;
  let table = null;
  let want = null;     // null, or names by column index (sparse for the scan, dense for the parse)
  let retainAll = false;
  let maxIdx = -1;
  let tail = '';
  let lastRecord = '';
  let records = 0;
  let lines = 0;
  let rowsWithNoFieldRead = 0;
  const scratch = {};

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes.total += value.length;

    // One byte compare inside the loop this pass already runs (040). `indexOf` on a
    // TypedArray, so the common case — no NUL anywhere — costs one scan in C++.
    for (let at = value.indexOf(0); at !== -1; at = value.indexOf(0, at + 1)) bytes.nul++;

    const text = tail + decoder.decode(value, true);
    let start = 0;
    for (;;) {
      const nl = text.indexOf('\n', start);
      if (nl === -1) { tail = text.slice(start); break; }
      let line = text.slice(start, nl);
      start = nl + 1;
      if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
      if (line.length === 0) continue;
      lines++;
      lastRecord = line;

      if (line.charCodeAt(0) === 0x25) {           // '%'
        const kind = line.charCodeAt(1);
        if (kind === 0x52) {                       // %R
          records++;
          if (table === null) continue;
          if (want === null) { rowsWithNoFieldRead++; driver.row(table, null); continue; }
          // The scan reuses one scratch object; the parse gets a fresh one per row,
          // which is the whole difference between O(1) and O(file) in this loop.
          driver.row(table, sliceRow(line, want, maxIdx, retainAll ? {} : scratch));
        } else if (kind === 0x54) {                // %T
          table = line.slice(3);
          want = null;
          retainAll = false;
          maxIdx = -1;
          driver.table(table);
        } else if (kind === 0x46) {                // %F
          const names = line.slice(3).split('\t');
          const asked = driver.wants(table);
          if (asked === 'all') {
            retainAll = true;
            want = names;
            maxIdx = names.length - 1;
          } else if (asked) {
            want = [];
            for (let i = 0; i < names.length; i++) {
              if (asked.includes(names[i])) { want[i] = names[i]; maxIdx = i; }
            }
            if (maxIdx === -1) want = null;
          }
        } else if (kind === 0x45) {                // %E
          reachesEnd = true;
        }
      } else if (line.startsWith('ERMHDR')) {
        driver.ermhdr(line);
      }
      // Anything else is a continuation line (002). Both drivers ignore it rather than
      // reassembling it — safe for every count and every field either one reads, and a
      // known limitation for one thing only: a wrapped TASKMEMO shows truncated.
    }
  }
  if (tail.length > 0) { lines++; lastRecord = tail; }
  if (lastRecord.trim() === '%E') reachesEnd = true;

  return {
    bytes: bytes.total,
    nul_byte_count: bytes.nul,
    reaches_end_marker: reachesEnd,
    records,
    lines,
    rows_with_no_field_read: rowsWithNoFieldRead,
    decoder: decoder.name,
  };
}

/**
 * Walk a %R row once, slicing only the wanted columns.
 *
 * Splitting the whole row would allocate one string per field for every row in the
 * file, which is the cost the scan exists to avoid.
 */
function sliceRow(line, want, maxIdx, out) {
  let col = 0;
  let from = 4; // past "%R\t"
  while (col <= maxIdx) {
    const tab = line.indexOf('\t', from);
    const end = tab === -1 ? line.length : tab;
    const name = want[col];
    if (name !== undefined) out[name] = line.slice(from, end);
    if (tab === -1) break;
    from = tab + 1;
    col++;
  }
  return out;
}

// ---- the discarding driver: the scan ----------------------------------------

function scanDriver() {
  const r = {
    ermhdr: null,
    p6_version: null,
    tables: {},
    project_rows: [],
    projwbs: { count: 0, roots: 0, root_name: null, ids: new Set() },
    task: {
      count: 0,
      proj_ids: new Set(),
      create_user: new Set(),
      update_user: new Set(),
      status_mix: {},
      type_mix: {},
      min_start: null,
      max_finish: null,
    },
    rsrc: { count: 0, names: new Capped(LIST_CAP), types: {}, notes: new Capped(LIST_CAP), probes: {} },
    taskmemo: { count: 0, memos: new Capped(LIST_CAP) },
    udftype: [],
    udfvalue_by_type: {},
    taskuser: { count: 0, user_ids: new Capped(LIST_CAP) },
    document: { count: 0, authors: new Capped(LIST_CAP) },
  };
  for (const p of ['email_addr', 'office_phone', 'other_phone', 'employee_code', 'user_id']) {
    r.rsrc.probes[p] = 0;
  }

  return {
    state: r,
    wants: (table) => WANTED[table] ?? null,
    ermhdr(line) {
      if (r.ermhdr !== null) return;
      r.ermhdr = line;
      r.p6_version = line.split('\t')[1] ?? null;
    },
    table(name) { if (r.tables[name] === undefined) r.tables[name] = 0; },
    row(table, row) {
      r.tables[table] = (r.tables[table] ?? 0) + 1;
      if (row === null) return;
      visit(r, table, row);
    },
  };
}

function visit(r, table, row) {
  switch (table) {
    case 'PROJECT':
      if (r.project_rows.length < 16) {
        r.project_rows.push({
          proj_id: row.proj_id,
          proj_short_name: row.proj_short_name,
          last_recalc_date: row.last_recalc_date,
          add_by_name: row.add_by_name,
        });
      }
      break;
    case 'PROJWBS':
      r.projwbs.count++;
      if (row.proj_node_flag === 'Y' && r.projwbs.root_name === null) {
        r.projwbs.root_name = row.wbs_name;
        r.projwbs.roots++;
      }
      if (r.projwbs.ids.size < 20000) r.projwbs.ids.add(row.wbs_id);
      break;
    case 'TASK': {
      const t = r.task;
      t.count++;
      t.proj_ids.add(row.proj_id);
      if (t.create_user.size < USER_SET_CAP) t.create_user.add(row.create_user);
      if (t.update_user.size < USER_SET_CAP) t.update_user.add(row.update_user);
      t.status_mix[row.status_code] = (t.status_mix[row.status_code] ?? 0) + 1;
      t.type_mix[row.task_type] = (t.type_mix[row.task_type] ?? 0) + 1;
      const s = row.act_start_date || row.early_start_date || row.target_start_date;
      const f = row.act_end_date || row.early_end_date || row.target_end_date;
      if (s && (t.min_start === null || s < t.min_start)) t.min_start = s;
      if (f && (t.max_finish === null || f > t.max_finish)) t.max_finish = f;
      break;
    }
    case 'RSRC': {
      const x = r.rsrc;
      x.count++;
      x.names.push(row.rsrc_name);
      x.types[row.rsrc_type] = (x.types[row.rsrc_type] ?? 0) + 1;
      if (row.rsrc_notes) x.notes.push(row.rsrc_notes.slice(0, NOTE_CHARS));
      for (const p of Object.keys(x.probes)) if (row[p]) x.probes[p]++;
      break;
    }
    case 'TASKMEMO':
      r.taskmemo.count++;
      if (row.task_memo) r.taskmemo.memos.push(row.task_memo.slice(0, MEMO_CHARS));
      break;
    case 'UDFTYPE':
      if (r.udftype.length < LIST_CAP) {
        r.udftype.push({ id: row.udf_type_id, label: row.udf_type_label, table: row.table_name });
      }
      break;
    case 'UDFVALUE': {
      // Column 0 only — a counter keyed on udf_type_id, which is what makes the one
      // enormous PI-suspect surface cost O(number of UDF types) rather than O(rows).
      const k = row.udf_type_id;
      r.udfvalue_by_type[k] = (r.udfvalue_by_type[k] ?? 0) + 1;
      break;
    }
    case 'TASKUSER':
      r.taskuser.count++;
      if (row.user_id) r.taskuser.user_ids.push(row.user_id);
      break;
    case 'DOCUMENT':
      r.document.count++;
      if (row.author_name) r.document.authors.push(row.author_name);
      break;
    default:
      break;
  }
}

/** The `ScanResult` 011's rules are functions over. Sets become sizes; nothing grows. */
function finalise(r, meta) {
  return {
    p6_version: r.p6_version,
    ermhdr_present: r.ermhdr !== null,
    bytes: meta.bytes,
    lines: meta.lines,
    records: meta.records,
    rows_with_no_field_read: meta.rows_with_no_field_read,
    tables: r.tables,
    table_count: Object.keys(r.tables).length,
    project_row_count: r.project_rows.length,
    projects: r.project_rows,
    data_date: r.project_rows[0]?.last_recalc_date ?? null,
    activity_count: r.task.count,
    distinct_task_proj_id: r.task.proj_ids.size,
    status_mix: r.task.status_mix,
    activity_type_mix: r.task.type_mix,
    date_range: { min_start: r.task.min_start, max_finish: r.task.max_finish },
    create_users: r.task.create_user.size,
    update_users: r.task.update_user.size,
    wbs: { node_count: r.projwbs.count, root_name: r.projwbs.root_name },
    resources: { count: r.rsrc.count, names: r.rsrc.names.toJSON(), types: r.rsrc.types,
      notes: r.rsrc.notes.toJSON(), probes: r.rsrc.probes },
    memos: { count: r.taskmemo.count, kept: r.taskmemo.memos.toJSON() },
    udf_types: r.udftype.length,
    udf_values_by_type: r.udfvalue_by_type,
    taskuser: { count: r.taskuser.count },
    documents: { count: r.document.count, authors: r.document.authors.toJSON() },
    reaches_end_marker: meta.reaches_end_marker,
    nul_byte_count: meta.nul_byte_count,
    decoder: meta.decoder,
  };
}

export async function scan(streamOrFile) {
  const driver = scanDriver();
  const meta = await tokenize(streamOrFile, driver);
  return finalise(driver.state, meta);
}

// ---- the retaining driver: the full parse -----------------------------------

/**
 * The other driver — every table held whole, which is what 011 originally specified
 * and what 020 replaced.
 *
 * It exists here for one job: to be the **control** on the constrained-heap runs. A
 * heap ceiling that nothing dies at proves nothing, because it might not be a ceiling
 * at all. The full parse is the thing that is supposed to die, so it is what says the
 * knob bites.
 */
export async function parse(streamOrFile) {
  const tables = {};
  let ermhdr = null;
  let current = null;

  const meta = await tokenize(streamOrFile, {
    wants: () => 'all',
    ermhdr(line) { if (ermhdr === null) ermhdr = line; },
    table(name) { current = tables[name] ?? (tables[name] = { name, rows: [] }); },
    row(table, row) {
      const t = current && current.name === table ? current : tables[table];
      if (t && row) t.rows.push(row);
    },
  });

  let rowCount = 0;
  let cells = 0;
  for (const t of Object.values(tables)) {
    rowCount += t.rows.length;
    cells += t.rows.length * Object.keys(t.rows[0] ?? {}).length;
  }
  return {
    ok: true,
    ermhdr_present: ermhdr !== null,
    table_count: Object.keys(tables).length,
    row_count: rowCount,
    approx_cells: cells,
    activity_count: tables.TASK?.rows.length ?? 0,
    bytes: meta.bytes,
    records: meta.records,
    reaches_end_marker: meta.reaches_end_marker,
    // A value read out of the retained tables at the very end, so nothing above can be
    // collected early on the strength of never being looked at.
    last_task_code: tables.TASK?.rows[tables.TASK.rows.length - 1]?.task_code ?? null,
  };
}

// ---- the platform APIs ------------------------------------------------------

/** The three platform APIs the upload page requires, checked by USE, not by typeof. */
export async function probeApis() {
  const out = {};

  out.secure_context = typeof isSecureContext === 'undefined' ? null : isSecureContext;

  // Blob.stream()
  try {
    const b = new Blob([new Uint8Array([1, 2, 3])]);
    if (typeof b.stream !== 'function') throw new Error('Blob.prototype.stream is not a function');
    const rd = b.stream().getReader();
    const { value } = await rd.read();
    await rd.cancel();
    out['Blob.stream()'] = { present: true, works: value.length === 3 };
  } catch (e) { out['Blob.stream()'] = { present: false, error: String(e) }; }

  // CompressionStream
  try {
    if (typeof CompressionStream === 'undefined') throw new Error('CompressionStream is undefined');
    const src = new Blob([new Uint8Array(4096)]).stream();
    const gz = new Response(src.pipeThrough(new CompressionStream('gzip')));
    const buf = new Uint8Array(await gz.arrayBuffer());
    out.CompressionStream = {
      present: true,
      works: buf[0] === 0x1f && buf[1] === 0x8b,   // gzip magic, not raw deflate
      gzipped_bytes: buf.length,
    };
  } catch (e) { out.CompressionStream = { present: false, error: String(e) }; }

  // crypto.subtle.digest
  try {
    if (!globalThis.crypto || !crypto.subtle) throw new Error('crypto.subtle is undefined');
    if (typeof crypto.subtle.digest !== 'function') throw new Error('crypto.subtle.digest is not a function');
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
    const hex = [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
    out['crypto.subtle.digest'] = {
      present: true,
      // The published SHA-256 of "abc". A digest that is present but wrong is worse
      // than one that is absent, because the dedup hash is 011's duplicate check.
      works: hex === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      sha256_abc: hex,
    };
  } catch (e) { out['crypto.subtle.digest'] = { present: false, error: String(e) }; }

  // Instruments, not requirements — recorded because they decide what can be measured.
  out.instruments = {
    'performance.memory': typeof performance !== 'undefined' && 'memory' in performance,
    'performance.measureUserAgentSpecificMemory':
      typeof performance !== 'undefined' && typeof performance.measureUserAgentSpecificMemory === 'function',
    crossOriginIsolated: typeof crossOriginIsolated === 'undefined' ? null : crossOriginIsolated,
  };
  return out;
}

// ---- the whole client step --------------------------------------------------

/**
 * Hash, scan and gzip over one read, as 020 settled it.
 *
 * WebCrypto has no streaming digest, so the hash is `crypto.subtle.digest` over the
 * file's bytes and the scan and the gzip share a tee'd stream (020 §4). The gzipped
 * blob is the only thing retained at any size, because the PUT needs it and S3 signing
 * needs its exact length.
 */
export async function clientStep(file, opts = {}) {
  const t0 = performance.now();

  let hashHex = null;
  let hashMs = null;
  if (opts.hash !== false) {
    const hs = performance.now();
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    hashHex = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
    hashMs = performance.now() - hs;
  }

  const ss = performance.now();
  let scanResult;
  let gzipBytes = null;
  let gzipBlob = null;

  if (opts.gzip === false) {
    scanResult = await scan(file);
  } else {
    const [forScan, forGzip] = file.stream().tee();
    const gzipping = (async () => {
      const chunks = [];
      let total = 0;
      const rd = forGzip.pipeThrough(new CompressionStream('gzip')).getReader();
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      gzipBlob = new Blob(chunks, { type: 'application/gzip' });
      return total;
    })();
    [scanResult, gzipBytes] = await Promise.all([scan(forScan), gzipping]);
  }
  const scanGzipMs = performance.now() - ss;

  return {
    ok: true,
    wall_ms: performance.now() - t0,
    hash_ms: hashMs,
    scan_gzip_ms: scanGzipMs,
    sha256: hashHex,
    gzip_bytes: gzipBytes,
    gzip_blob_size: gzipBlob ? gzipBlob.size : null,
    raw_bytes: file.size,
    scan: scanResult,
  };
}
