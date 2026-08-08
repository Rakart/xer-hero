// Streaming .xer writer.
//
// Physical format (xer-format.md): line-oriented, tab-delimited, CRLF-terminated,
// CP1252. ERMHDR first (the one record that is NOT %-prefixed), then %T/%F/%R per
// table, then %E.

import fs from 'node:fs';
import { encodeCp1252 } from './cp1252.mjs';
import { SCHEMA, TABLE_ORDER } from './schema.mjs';

const CRLF = '\r\n';

// Every field name P6 emits in either version. A row may legitimately carry a field
// the target version does not have (est_wt is 6.0-only, location_id is 8.3-only) —
// that gets dropped. A name in neither set is a typo and stops the generator.
const ALL_FIELDS = new Set(
  Object.values(SCHEMA).flatMap((tables) => Object.values(tables).flat()),
);

const cell = (v) => {
  if (v === undefined || v === null) return '';
  return String(v);
};

/**
 * @param {string} path
 * @param {object} opts
 * @param {'6.0'|'8.3'} opts.version
 * @param {object} opts.header        ERMHDR fields (see defaults below)
 * @param {{name:string, fields?:string[], rows:Iterable<object>}[]} opts.tables
 *        Emitted in the order given. `fields` overrides the schema, which is how a
 *        fixture emits a table P6 never documented or a deliberately odd field set.
 */
export async function writeXer(path, { version, header = {}, tables }) {
  const out = fs.createWriteStream(path);
  const write = (str) => {
    if (!out.write(encodeCp1252(str))) {
      return new Promise((resolve) => out.once('drain', resolve));
    }
    return null;
  };

  const h = {
    version,
    exportDate: '2026-08-07',
    exportType: 'Project',
    userLogin: 'admin',
    userName: 'Primavera Admin',
    dbName: 'dbxDatabaseNoName',
    module: 'Project Management',
    currency: 'USD',
    ...header,
  };
  await write(['ERMHDR', h.version, h.exportDate, h.exportType, h.userLogin, h.userName,
    h.dbName, h.module, h.currency].join('\t') + CRLF);

  for (const table of tables) {
    const fields = table.fields ?? SCHEMA[version][table.name];
    if (!fields) throw new Error(`no %F contract for ${table.name} in P6 ${version}`);
    await write(`%T\t${table.name}${CRLF}%F\t${fields.join('\t')}${CRLF}`);

    let batch = '';
    let rowCount = 0;
    for (const row of table.rows) {
      for (const key of Object.keys(row)) {
        if (!fields.includes(key) && !ALL_FIELDS.has(key)) {
          throw new Error(`${table.name}: field "${key}" is not a P6 field name`);
        }
      }
      batch += `%R\t${fields.map((f) => cell(row[f])).join('\t')}${CRLF}`;
      rowCount++;
      if (rowCount % 2000 === 0) {
        const pending = write(batch);
        batch = '';
        if (pending) await pending;
      }
    }
    if (batch) {
      const pending = write(batch);
      if (pending) await pending;
    }
  }

  await write(`%E${CRLF}`);
  await new Promise((resolve, reject) => {
    out.end(resolve);
    out.on('error', reject);
  });
  return fs.statSync(path).size;
}

/**
 * Table order as P6 emits it, filtered to the tables a fixture actually carries and
 * to the tables that exist in the target version (UMEASURE is 8.3-only here).
 * Tables with an explicit `fields` override pass through — that is how a fixture
 * emits something Oracle never documented.
 */
export function orderTables(version, byName) {
  const emitted = (n) => byName[n] && (byName[n].fields || SCHEMA[version][n]);
  const known = TABLE_ORDER[version].filter(emitted).map((n) => byName[n]);
  const extra = Object.keys(byName)
    .filter((n) => !TABLE_ORDER[version].includes(n) && emitted(n))
    .map((n) => byName[n]);
  return [...known, ...extra];
}
