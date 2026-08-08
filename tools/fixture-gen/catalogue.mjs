// The fixture catalogue.
//
// Three kinds of fixture, deliberately kept apart (012):
//
//   corpus/   correctness. Tens of rows, each file exercising ONE known landmine.
//             Committed with a golden expectation file. This is the only test corpus
//             CI will ever have, because real .xer files are gitignored forever.
//   sparse-150.xer  rendering. "Does the card look broken with barely any data."
//   perf-*.xer      perf. 20,000 activities. Generated on demand, never committed —
//                   tens of MB reproducible from a seed is not worth a git object.

import { buildClndrData } from './lib/calendar.mjs';

// Corpus files stay small enough to read by eye: 20 activities, and every other
// dimension turned down to the minimum that still exercises the table.
const corpus = (name, description, landmine, entry) => ({
  name,
  description,
  landmine,
  dir: 'corpus',
  activities: 20,
  wbsNodes: 6,
  wbsDepth: 3,
  codesPerActivity: 3,
  rsrcPerActivity: 0.5,
  udfPerActivity: 2,
  resources: 4,
  calendars: 2,
  ...entry,
});

export const CATALOGUE = [
  // ---- correctness corpus ---------------------------------------------------
  corpus('enc-mojibake-0x81',
    'POBS rows carrying 0x81 and double-encoded UTF-8, as Fixture B does',
    'Strict CP1252 decoding throws on 0x81. Fixture B has 31,485 of them and Fixture A\'s '
    + 'baseline has none, so a test that reads only a clean file misses this entirely.',
    { version: '8.3', tableOpts: { mojibake: true } }),

  corpus('enc-cp1252-currency',
    'CURRTYPE rows using the high-byte currency symbols found in real files',
    'UTF-8 decoding mangles or throws on 0xA3 (£), 0xA5 (¥) and 0xD8 (Ø). Activity '
    + 'names here also carry the CP1252 0x80-0x9F block (em dash, curly quotes), which '
    + 'is the part of CP1252 that is NOT Latin-1 and needs a real mapping table.',
    {
      version: '8.3',
      tableOpts: { currencies: ['USD', 'GBP', 'JPY', 'DKK'] },
      mutate(tables) {
        tables.TASK.rows[0].task_name = 'Cast Base Slab — north end';        // 0x97
        tables.TASK.rows[1].task_name = 'Install “Type A” Switchgear';       // 0x93 0x94
        tables.TASK.rows[2].task_name = 'Survey Façade — Ø450 duct';         // 0xE7 0x97 0xD8
      },
    }),

  corpus('cal-clndr-data',
    'Calendars in the indented CA_Base form: 0x7F runs, multi-shift days, exception working '
    + 'days and a VIEW node',
    '0x7F is LAYOUT inside clndr_data, not structure — cal-flat-no-0x7f carries the same '
    + 'tree without a single one. Multi-shift days, exception WORKING days and the VIEW node '
    + 'were the three shapes no real fixture was thought to exercise; 021 found all three in '
    + 'real exports, so this file asserts what they MEAN rather than merely that the parser '
    + 'survived them. The first calendar is a five-day week worked in two shifts either side '
    + 'of a lunch break, closed on 2026-01-01 and 2026-12-25 and bought back as a half day on '
    + '2026-01-03; the second is a seven-day week with no exceptions and no VIEW node.',
    {
      version: '8.3',
      mutate(tables) {
        tables.CALENDAR.rows[0].clndr_data = buildClndrData({
          workDays: [2, 3, 4, 5, 6],
          shifts: [['08:00', '12:00'], ['13:00', '17:00']],
          holidays: ['2026-01-01', '2026-12-25'],
          workingExceptions: [{ date: '2026-01-03', shifts: [['08:00', '12:00']] }],
          view: true,
        });
        tables.CALENDAR.rows[1].clndr_data = buildClndrData({
          workDays: [1, 2, 3, 4, 5, 6, 7], holidays: [], view: false,
        });
      },
    }),

  corpus('cal-flat-no-0x7f',
    'One calendar written twice — the indented CA_Base form and the flat CA_Project form '
    + 'P6 writes beside it',
    'The two CALENDAR rows have IDENTICAL meaning and different bytes, and a parser must '
    + 'decode them to the same working calendar. The first is the indented CA_Base '
    + 'serialisation, 0x7F pairs and leading spaces; the second is the CA_Project '
    + 'serialisation real exports carry in the same file — one flat line without a single '
    + '0x7F byte, shift attributes written FINISH FIRST (f|12:00|s|8:00), and the hour not '
    + 'zero-padded. Three ways to fail it: split on 0x7F as a record separator and the '
    + 'second row is one unparseable record; read the shift attributes positionally and it '
    + 'comes back with start and finish swapped; match the time with \\d\\d and it loses '
    + 'every shift beginning before 10:00. This is the %F header lesson one level down — '
    + 'key on the name, never on the position. The second row also carries an EMPTY '
    + 'day_hr_cnt and declares a 56-hour week over a pattern that works 40, because both '
    + 'counts are empty on some real calendars and contradict the day pattern on others: '
    + 'clndr_data is the only trustworthy statement of what a calendar means. All of it '
    + 'measured off real exports by 021 (assets/p6-substitute-validation.md).',
    {
      version: '8.3',
      mutate(tables) {
        // One definition, two serialisations. Anything that differs between the two rows
        // below is layout, and layout means nothing.
        const meaning = {
          workDays: [2, 3, 4, 5, 6],
          shifts: [['08:00', '12:00'], ['13:00', '17:00']],
          holidays: ['2026-01-01', '2026-12-25'],
          workingExceptions: [{ date: '2026-01-03', shifts: [['08:00', '12:00']] }],
          view: true,
        };
        tables.CALENDAR.rows[0].clndr_data = buildClndrData(meaning);
        tables.CALENDAR.rows[1].clndr_data = buildClndrData({
          ...meaning, layout: 'flat', shiftAttrs: 'finish-first', padHours: false,
        });
        // Row 2 is the project copy of row 1, which is what CA_Project means and why the
        // two say the same thing. Its declared hour counts do not.
        tables.CALENDAR.rows[1].clndr_name = '5 Day Working Week - Project';
        tables.CALENDAR.rows[1].day_hr_cnt = '';
        tables.CALENDAR.rows[1].week_hr_cnt = 56;
      },
    }),

  corpus('cal-default-unused',
    'The shape both real programmes have: three calendars declared, every activity on one '
    + 'of them, and default_flag on a calendar nothing uses',
    'The corpus\'s ten-and-ten split is a shape NO real programme produced, and until this '
    + 'file it was the only shape here. Across 14 real files the number of distinct '
    + 'TASK.clndr_id values is 1 on 14 of 14 against 3-5 CALENDAR rows, and on 14 of 14 it '
    + 'is the calendar PROJECT.clndr_id names; default_flag is absent from 12 of the 14 and '
    + 'on one of the other two it names a calendar holding 0 of 1,746 activities while '
    + 'every activity sits elsewhere (045). So this file declares three calendars, puts all '
    + '20 activities on the five-day one PROJECT.clndr_id names, and flags the seven-day one '
    + 'default_flag = Y with nothing on it: a parser reading default_flag as the programme '
    + 'calendar converts the span on a seven-day week and reports 100% of the span instead '
    + 'of 71%, with an activity_share_pct of 0 it never looks at. calendars_in_use is 1 '
    + 'against a calendar_count of 3, which is the number the detail page\'s Calendars tile '
    + 'wants and did not have. Its third row is a byte-identical project copy of the first, '
    + 'so the corpus gets a second same_meaning_as pair for free — this one with '
    + 'identical_bytes TRUE, which cal-flat-no-0x7f cannot show.',
    { version: '8.3', calendars: 3, oneCalendar: true, defaultFlagIdx: 1 }),

  corpus('cal-project-clndr-absent',
    'PROJECT.clndr_id names a calendar the file does not carry',
    'The second of 045\'s two unavailable-for-a-calendar-reason branches, and the one '
    + 'nothing tested. missing-calendar pins the first — no CALENDAR table at all — but a '
    + 'file can carry a perfectly good CALENDAR table and still name a calendar that is not '
    + 'in it, which is what a hand-edited or partially exported file looks like. '
    + 'duration_working_days must report unavailable naming the id it could not find, NOT '
    + 'fall back to default_flag, to the first CALENDAR row, or to the calendar most '
    + 'activities happen to be on — all three of which are present here and all three of '
    + 'which would produce a plausible number. The two calendars still decode, so the '
    + 'calendars block is full and this file fails nothing else: the only thing wrong with '
    + 'it is the one field 011 does not reject on and 006 does not fail ingest for.',
    {
      version: '8.3',
      mutate(tables) {
        // 841 is the id 006's own worked example uses. Nothing in the model changes — the
        // programme is scheduled and emitted exactly as any other corpus file, and the
        // single edited field is the one the conversion reads.
        tables.PROJECT.rows[0].clndr_id = 841;
      },
    }),

  corpus('ver-60-fieldset',
    'P6 6.0 %F field sets — same programme as ver-83-fieldset',
    'TASK, PROJECT, PROJWBS, CALENDAR, RSRC, TASKRSRC and ACTVCODE differ in field '
    + 'ORDER as well as membership between 6.0 and 8.3. A parser indexing by position '
    + 'reads one of this pair wrong, silently, with no arity error.',
    { version: '6.0', seed: 42 }),

  corpus('ver-83-fieldset',
    'P6 8.3 %F field sets — same programme as ver-60-fieldset',
    'The 8.3 half of the version-drift pair. Field-name mapping must give the same '
    + 'answers from both files.',
    { version: '8.3', seed: 42 }),

  corpus('missing-taskpred',
    'A file with no TASKPRED table at all',
    'Every table is optional. A programme with no relationships is a real thing (an '
    + 'activity list export), and open-ends/DCMA-1 must not divide by zero. The dates '
    + 'were scheduled WITH logic, as a real activity-list export\'s are — which is why '
    + 'hideRelationships is a model option rather than a delete: the trace has to know '
    + 'it cannot see the logic, or the golden would assert a chain the file cannot show.',
    { version: '8.3', hideRelationships: true, mutate: (tables) => { delete tables.TASKPRED; } }),

  corpus('missing-calendar',
    'A file with no CALENDAR table',
    'Without a calendar there is no shift pattern, so working-day conversion has no basis, '
    + 'and duration_working_days must report unavailable rather than assume an eight-hour '
    + 'five-day week. day_hr_cnt was never the fallback either: Oracle documents it as a '
    + 'units-CONVERSION factor that is never validated against the shifts and defaults to 8 '
    + 'on every new calendar including 24-hour ones (xer-format.md gotcha 18, 038, 048) — '
    + 'and there is no CALENDAR row here to read it off in any case. This is now the only '
    + 'PROGRAMME in the corpus reporting unavailable for the no-table reason: since 047 the '
    + 'other 26 report a value, so this file and enc-zeroed-file are what stop the '
    + 'conversion inventing one. Note calendars_in_use is 2 against a calendar_count of 0 — '
    + 'the TASK rows still name the calendars the file no longer carries, which is the '
    + 'shape a table-level deletion leaves and is why the count is taken off TASK.clndr_id.',
    { version: '8.3', mutate: (tables) => { delete tables.CALENDAR; } }),

  corpus('wbs-flat',
    'PROJWBS = 1: every activity under a single node',
    'Fixture B\'s real shape. wbs_depth is legitimately 1 — degenerate but not an error '
    + '— so any card or chart keyed on WBS has to render at depth 1.',
    { version: '8.3', wbsNodes: 1 }),

  corpus('progress-none',
    '100% TK_NotStart, no actuals anywhere',
    'A pure baseline. Roughly a third of the derived stats are uncomputable and DCMA '
    + '11/13/14 skip. Skip is not fail.',
    { version: '8.3', progress: 'none' }),

  corpus('progress-full',
    'Fully progressed: every activity complete, with actual dates',
    'The opposite pole. Completed activities carry EMPTY float, not zero float — '
    + 'coercing empty to zero reports spurious critical activities.',
    { version: '8.3', progress: 'full' }),

  corpus('float-negative',
    'A programme pulled behind its deadline: negative and null float together',
    'Fixture A runs 69% negative float. Float is an integer count of HOURS and may be '
    + 'negative; empty float on completed work is a different claim from zero.',
    { version: '8.3', progress: 'partial', deadlineSlipDays: 60 }),

  corpus('multiproj-two-proj-id',
    'Activities under two distinct TASK.proj_id values',
    'MUST REJECT. 011 rejects multi-project exports in v1 and the discriminator is '
    + 'distinct TASK.proj_id > 1.',
    { version: '8.3', projects: 2, ingest: { accept: false, reason: 'distinct TASK.proj_id > 1' } }),

  corpus('multiproj-baseline-rows',
    'Three PROJECT rows, one owning proj_id — a baseline-bearing export',
    'MUST INGEST. This is the shape that makes PROJECT row count the wrong '
    + 'discriminator: a legal export carrying baselines has several PROJECT rows.',
    {
      version: '8.3',
      extraProjectRows: 2,
      ingest: { accept: true, reason: 'single owning TASK.proj_id despite 3 PROJECT rows' },
    }),

  corpus('text-multiline',
    'An activity name containing an embedded newline, and one containing a lone CR',
    'The format has no escaping mechanism and neither real fixture exercises multi-line '
    + 'free text. A naive line-splitter silently corrupts the row. Recovery rule: a line '
    + 'not starting with a known marker is a continuation, and the joined row must match '
    + 'the %F arity.',
    {
      version: '8.3',
      speculative: true,
      mutate(tables) {
        tables.TASK.rows[3].task_name = 'Install Switchgear\r\n(second line of the name)';
        tables.TASK.rows[7].task_name = 'Cast Base Slab\rphase 2';
      },
    }),

  corpus('unknown-table-and-enum',
    'An undocumented table plus enum values outside the observed sets',
    'POBS appears in real files and is not in Oracle\'s 73-table list. Unknown tables '
    + 'and unknown enum values are normal and must not error — store the raw string.',
    {
      version: '8.3',
      mutate(tables) {
        tables.TASK.rows[1].task_type = 'TT_LOE';
        tables.TASK.rows[2].task_type = 'TT_WBS';
        tables.TASK.rows[4].cstr_type = 'CS_MANDFIN';
        tables.TASK.rows[5].complete_pct_type = 'CP_Phys';
        if (tables.TASKPRED.rows[0]) tables.TASKPRED.rows[0].pred_type = 'PR_SF';
        tables.ZZUNKNOWN = {
          name: 'ZZUNKNOWN',
          fields: ['zz_id', 'proj_id', 'zz_name', 'zz_value'],
          rows: [
            { zz_id: 1, proj_id: 90001, zz_name: 'undocumented', zz_value: 'A' },
            { zz_id: 2, proj_id: 90001, zz_name: 'table', zz_value: 'B' },
          ],
        };
      },
    }),

  corpus('external-relationship',
    'TASKPRED rows whose pred_proj_id points outside the file',
    'A dangling predecessor is legitimate, not corruption — external logic points at an '
    + 'activity that may not be in the export at all.',
    { version: '8.3', externalRels: 3 }),

  // ---- the unreadable pair (040) ---------------------------------------------
  // Neither of these is a programme. Both are damage, and the golden for each is
  // written from the BYTES rather than from the model, because there is no intent in
  // a corrupt file to write it from. They are a pair on purpose: the same guard
  // catches both, and no cheaper rule catches both.

  {
    name: 'enc-zeroed-file',
    dir: 'corpus',
    noProgramme: true,
    description: '397,781 bytes of pure NUL, with a .xer extension and an ordinary size',
    landmine: 'MUST REJECT AS UNREADABLE. One real file in 139 is exactly this — a .xer in '
      + 'a tender folder, 100% zero bytes, plausible sync corruption, a wholly ordinary '
      + 'size that sails past any size check. MPXJ reads it as null with no exception and '
      + 'no message, and a scan that counts what it recognises counts zero of everything '
      + 'without anything going wrong. Every count in this golden is therefore a zero — '
      + 'which is precisely why no count can be the discriminator: a scan result of all '
      + 'zeros is indistinguishable from a very small programme. The guard is readability, '
      + 'and this file fails both halves of it: no %E as the last record, and 397,781 NUL '
      + 'bytes in a format that is CP1252 text throughout. It is also the file that shows '
      + 'why "no ERMHDR on line 1" is the wrong VERDICT even where it is the right answer '
      + '— the planner is not holding the wrong kind of file, they are holding a broken '
      + 'copy of the right one, and the useful thing to tell them is to fetch it again.',
    corrupt: () => Buffer.alloc(397781),
    ingest: {
      accept: false,
      guard: 'unreadable',
      reason: 'no %E end marker, and 397,781 NUL bytes',
      message: 'This file is not a complete P6 export. Every one of its 397,781 bytes is '
        + 'zero — there is no header, no data and no end-of-file marker in it at all. '
        + 'That is what an interrupted download or a file-sync error leaves behind, not '
        + 'anything P6 wrote. Download or re-export the file, then try again.',
    },
  },

  corpus('enc-truncated-export',
    'A complete-looking export with its %E end marker cut off and the tail zero-padded',
    'MUST REJECT AS UNREADABLE, and this is the file that says why "no ERMHDR" cannot be '
    + 'the rule: the header is perfect, every table is whole, every %R row matches its %F '
    + 'arity, the activity count is right, and the only thing wrong is that P6 never said '
    + 'the file had finished. A truncation landing on a table boundary is indistinguishable '
    + 'from a complete export EXCEPT by the end marker — accept it and you accept a file '
    + 'that may be missing TASKPRED, CALENDAR and half the programme\'s meaning while '
    + 'reporting an activity count as though it were the whole story. That is 021\'s MPXJ '
    + 'failure mode one level up: not "no error and no project" but "no error and half a '
    + 'project". Pair it with missing-taskpred, which is the same shape and is LEGITIMATE: '
    + 'a sparse file ends with %E and a truncated one does not, and that is the whole of '
    + 'the difference. The zeros are not inert either — the continuation rule swallows '
    + 'them into the last row\'s last field, so the padding corrupts a value as well as '
    + 'ending the file in the wrong place. Not observed in the 139 real exports (all 138 '
    + 'readable ones end with %E), but nothing about it is a guess at P6 behaviour: a '
    + 'truncated file is a prefix of a good one plus zeros, and there is no P6 semantic '
    + 'here to be wrong about.',
    {
      version: '8.3',
      // Cut the end marker and nothing else, then pad with NUL to the next filesystem
      // block — a short write, which is what stops mid-file in the wild. Deliberately
      // the SMALLEST possible truncation: a bigger cut would be caught by an arity
      // error or a zero activity count, which would let an implementation with no
      // completeness check at all pass this file for the wrong reason.
      corrupt: (bytes) => {
        const complete = bytes.length - '%E\r\n'.length;
        const block = 4096;
        const padded = Math.ceil((complete + 1) / block) * block;
        return Buffer.concat([bytes.subarray(0, complete), Buffer.alloc(padded - complete)]);
      },
      ingest: {
        accept: false,
        guard: 'unreadable',
        reason: 'no %E end marker; the file stops on a table boundary and is zero-padded',
        message: 'This file is not a complete P6 export. It reads correctly for its first '
          + '33,422 bytes and then stops — no end-of-file marker, and 3,442 zero bytes on '
          + 'the end. There is no way to tell how much of the programme is missing, so the '
          + '20 activities it does show cannot be taken as the whole of it. Download or '
          + 're-export the file, then try again.',
      },
    }),

  // ---- the tracer's landmines (014, carried by 022) --------------------------
  // Every file above carries a driving_path block in its golden too, because the walk
  // runs on every fixture. These seven exist because the walk has seven outcomes that
  // nothing else in the corpus produces.

  corpus('logic-driving-branch',
    'Two predecessors both driving one activity — the Longest Path branches',
    'A driving path is a SET, not a chain (014 decision 3): ties are all kept because '
    + 'P6\'s own flag marks every branch. A tracer that keeps one predecessor per '
    + 'activity produces a chain that is a subset of the truth and cannot be told '
    + 'apart from a correct one on any file where nothing ties.',
    {
      version: '8.3',
      progress: 'none',
      relTypes: [['PR_FS', 100]],
      lagPct: 0,
      leadPct: 0,
      predPerActivity: 3,
      forceDrivingBranch: 3,
    }),

  corpus('logic-cycle',
    'A logic loop on the driving chain — a network P6 could never have scheduled',
    'The walk has to terminate and report rather than hang or recurse forever. 014 '
    + 'decision 5 makes a cycle a FINDING (logic.cycle_count) as well as a failure: '
    + 'longest_path is state "error" and ingest still succeeds. The dates in this file '
    + 'are deliberately incoherent — a cyclic file was never successfully scheduled.',
    { version: '8.3', progress: 'none', relTypes: [['PR_FS', 100]], lagPct: 0, leadPct: 0, injectCycle: 1 }),

  corpus('logic-external-driver',
    'The chain\'s tail is an activity in another project, absent from the file',
    'MUST NOT be read as a broken chain. 014 decision 5: a chain reaching a predecessor '
    + 'not in the file is state "ok" with truncated: true and an info issue. The '
    + 'TASKPRED rows pointing at 999001/90099 are the only trace of the driver, exactly '
    + 'as in a real single-project export.',
    { version: '8.3', progress: 'none', relTypes: [['PR_FS', 100]], lagPct: 0, leadPct: 0, externalDrivingPred: true }),

  corpus('logic-complete-no-remaining',
    '100% complete — the walk has no remaining work to walk back over',
    'The Longest Path spans REMAINING work, so a finished programme has none and '
    + 'longest_path is state "skip" (014 decision 5). Skip is not error and not zero: a '
    + 'tracer that takes max() over an empty remaining set, or that falls back to float '
    + 'and finds nothing because completed float is empty, both look like success here.',
    { version: '8.3', progress: 'full', relTypes: [['PR_FS', 100]], lagPct: 0, leadPct: 0 }),

  corpus('logic-lag-nonworking',
    'FS relationships with multi-day lags, on a five-day calendar',
    'The limitation 014 decision 4 accepted, STATED rather than hidden. Lag is an hour '
    + 'count and which calendar converts it is a SCHEDOPTIONS setting; the tracer treats '
    + 'it as elapsed hours, which is wrong across non-working time. The golden\'s '
    + 'as_read_from_the_file.why names every activity where that changes the answer — '
    + 'those are allowed disagreements, and any OTHER disagreement is a bug.',
    {
      version: '8.3',
      progress: 'none',
      relTypes: [['PR_FS', 100]],
      lagPct: 0.6,
      leadPct: 0,
      // Dense on purpose: a lag can only change the ANSWER where two predecessors
      // compete, and at the corpus default of 1.7 most activities have exactly one.
      predPerActivity: 4,
    }),

  corpus('logic-nonfs-drivers',
    'SS, FF and SF relationships ON the driving chain, not merely present in the file',
    'The second approximation in 014 decision 4, found by 028 and repaired by 031. As '
    + 'originally written the rule tested every relationship type with EF + lag, which '
    + 'is the quantity only an FS relationship constrains: SS constrains the successor\'s '
    + 'START from the predecessor\'s start, and FF/SF constrain its FINISH. The corpus '
    + 'carried 38 non-FS relationships before this file and not one FF or SF among them '
    + 'drove anything, so both rules scored the same and the non-FS branches were never '
    + 'executed. Here the chain runs FF, FF, SS, FF, FS, FS, SF+SF, FS: an EF + lag '
    + 'reader misses two activities, loses the SF branch and invents two branches that '
    + 'are not there, and the per-type rule reproduces all six fields exactly. No lags '
    + 'and no leads, so relationship type is the only thing that can explain a '
    + 'disagreement — which is what makes this file fail any tracer that reverts.',
    {
      version: '8.3',
      progress: 'none',
      relTypes: [['PR_FS', 25], ['PR_SS', 25], ['PR_FF', 25], ['PR_SF', 25]],
      lagPct: 0,
      leadPct: 0,
      // Dense for the same reason as logic-lag-nonworking: a relationship type can only
      // change the ANSWER where two predecessors compete for one successor.
      predPerActivity: 3,
    }),

  corpus('logic-no-longest-path',
    'Progressed, behind its deadline, and P6 never ran Longest Path',
    'The case 014 exists for, in Fixture A\'s shape: driving_path_flag is empty on every '
    + 'row — how most real exports arrive (1 of 3,344 activities on Fixture B) — and the '
    + 'programme is far enough behind that most of what remains carries negative float. '
    + 'There is no oracle in the file, so the golden IS the oracle, and this is the file '
    + 'where reaching for float instead of walking the logic is most tempting and most '
    + 'wrong: 19 activities have total float <= 0 and 4 are on the Longest Path.',
    {
      version: '8.3',
      progress: 'partial',
      deadlineSlipDays: 60,
      longestPathFlag: false,
      // 40 rather than the corpus's usual 20: the gap between the float set and the
      // driving set is a proportion, and at 20 activities with 8 remaining there is
      // not enough programme left for the proportion to mean anything.
      activities: 40,
      wbsNodes: 10,
    }),

  corpus('logic-float-path',
    'float_path / float_path_order populated — P6\'s Multiple Float Paths output, ranked '
    + 'by total float',
    '014 decision 11 makes float_path a second oracle; 021 then measured what it says, on '
    + 'a real revision carrying it for 1,570 of 1,751 activities across 384 paths. ORDER is '
    + 'the half that held: float_path_order runs 1..n contiguously along a path, 1..79 '
    + 'there. MEMBERSHIP is the half that did not — path 1 is the LOWEST-TOTAL-FLOAT chain, '
    + 'and it shared no member at all with the 75 activities that file flagged '
    + 'driving_path_flag = Y, whose float ran -862 to -502. Here path 1 is 9 activities at '
    + '-160 hours behind a Finish On or Before deadline, the 10 flagged activities are '
    + 'path 3 at zero float, and the two sets are disjoint, so a tracer reading float_path '
    + '= 1 as the Longest Path scores 0% recall at 0% precision rather than drifting. '
    + 'Validation-time only: never an output, never a fallback source.',
    {
      version: '8.3',
      progress: 'none',
      relTypes: [['PR_FS', 100]],
      lagPct: 0,
      leadPct: 0,
      // 40 activities at a thinner logic density than the corpus default, because path 1
      // and the Longest Path have to be DIFFERENT chains: at 1.7 predecessors per
      // activity the cross-links fuse every long chain into the one driving the finish,
      // and the file can then only restate what it is meant to refute.
      activities: 40,
      predPerActivity: 1.0,
      // The mechanism, not a second landmine. Total float is measured against the
      // nearest binding late date and the Longest Path against the project finish; an
      // interim deadline in delay is what pulls the two apart in a real programme.
      interimDeadlineDays: 20,
      floatPaths: 6,
    }),

  // ---- rendering ------------------------------------------------------------
  {
    name: 'sparse-150',
    dir: '.',
    description: '150 activities — the sparse-data rendering case',
    landmine: 'Not a parser assertion. This is the file that answers "does the row, the '
      + 'S-curve and the float mix look broken when there is barely any data".',
    version: '8.3',
    activities: 150,
    wbsNodes: 14,
    progress: 'partial',
    deadlineSlipDays: 10,
    codesPerActivity: 6,
    resources: 8,
    calendars: 2,
  },

  // ---- perf -----------------------------------------------------------------
  {
    name: 'perf-20k',
    dir: 'generated',
    description: '20,000 activities at Fixture-B-like code density (~6 TASKACTV per activity)',
    landmine: 'The v1 cap 011 set, measured rather than guessed.',
    version: '8.3',
    activities: 20000,
    wbsNodes: 1800,
    wbsDepth: 5,
    progress: 'partial',
    deadlineSlipDays: 40,
    codesPerActivity: 6,
    resources: 40,
    calendars: 4,
  },
  {
    name: 'perf-20k-dense',
    dir: 'generated',
    description: '20,000 activities at Fixture-A-like code density (~14 TASKACTV per activity)',
    landmine: 'TASKACTV density varies more than 2x between two real programmes (14.0 codes '
      + 'per activity here against perf-20k\'s 6.0), and it is the table that drives file '
      + 'size. This is the variant that measures how far 20,000 activities can push the byte '
      + 'cap: 35.0 MB against 011\'s cap of 60 MB as 020 raised it, which is the evidence '
      + 'that the two caps no longer contradict.',
    version: '8.3',
    activities: 20000,
    wbsNodes: 1800,
    wbsDepth: 5,
    progress: 'partial',
    deadlineSlipDays: 40,
    codesPerActivity: 14,
    resources: 40,
    calendars: 4,
  },
  {
    name: 'perf-2k',
    dir: 'generated',
    description: '2,000 activities — a like-for-like scale point against the real fixtures',
    landmine: 'Sits between Fixture A (1,751) and Fixture B (3,344) so the synthetic '
      + 'measurements can be sanity-checked against the real ones.',
    version: '8.3',
    activities: 2000,
    wbsNodes: 180,
    progress: 'partial',
    deadlineSlipDays: 20,
    codesPerActivity: 10,
    resources: 25,
    calendars: 3,
  },
];
