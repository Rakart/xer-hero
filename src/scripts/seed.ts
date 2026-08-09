/**
 * Seeds the local stack with the dev catalogue (§4.9).
 *
 * **Seeding runs the real ingest path, server-side** — the product parser, the product derive
 * code, the product persistence code, the same S3 client. It skips exactly two things: the
 * browser parse and the presigned-PUT hop. Committed pre-computed JSON was rejected because it
 * would be a second producer of `derived.json` against a contract that has already moved twice.
 *
 * The honest cost of that decision is ordering — seeding cannot work before the parser and
 * derive exist, so a fresh clone shows an empty shelf early in development.
 *
 *   node tools/dev-catalogue/generate.mjs   # writes the .xer bytes (once)
 *   pnpm db:migrate
 *   pnpm db:seed
 *
 * The seed's real value is in the row states no generated `.xer` can produce: a monthly
 * revision series, a set of fork siblings, tombstoned programmes under both classes, a `failed`
 * row with its `failure_reason`, unsectored programmes, and vote and bookmark counts.
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import type { SectorCode } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import {
  appUser,
  bookmark,
  programme,
  programmeVote,
  revision,
  uploaderVote,
} from '@/lib/db/schema'
import { uniqueSlug } from '@/lib/identity'
import { FAILURE_REASONS } from '@/lib/ingest/failures'
import { ingestFromBytes } from '@/lib/ingest/ingest'

const CATALOGUE_DIR = join(process.cwd(), 'fixtures/dev-catalogue')
const TERMS_VERSION = 'v1'

interface Manifest {
  programmes: {
    name: string
    title: string
    /** The eight codes of §1.6, or blank — assigned here, never inferred from the file. */
    sector: SectorCode | null
    activities: number
    progress: string
    version: string
    file: string
  }[]
  revision_series: {
    programme: string
    revisions: { name: string; rev_no: number; file: string }[]
  }
  forks: { name: string; parent: string; title: string; change_note: string; file: string }[]
  tombstones: { programme: string; removal_class: 'A' | 'B' }[]
  failed: { programme: string }
}

/** Handles are the only identity on the shelf; the estate never stores a real name. */
const CONTRIBUTORS = [
  'planner_dave',
  'clara_pmo',
  'north_rail_pm',
  'scheduler_47',
  'quantum_kate',
  'delivery_ops',
]

const db = getDb()

async function main() {
  const manifest: Manifest = JSON.parse(readFileSync(join(CATALOGUE_DIR, 'manifest.json'), 'utf8'))

  console.log('Seeding contributors…')
  const users = await seedUsers()

  const slugs = new Set<string>()
  const takenSlug = async (candidate: string) => {
    if (slugs.has(candidate)) return true
    const [existing] = await db
      .select({ slug: programme.slug })
      .from(programme)
      .where(eq(programme.slug, candidate))
      .limit(1)
    return Boolean(existing)
  }

  const idByName = new Map<string, { programmeId: string; revisionId: string; slug: string }>()
  const failedName = manifest.failed.programme
  const tombstoneOf = new Map(manifest.tombstones.map((t) => [t.programme, t.removal_class]))

  console.log(`Ingesting ${manifest.programmes.length} programmes through the product path…`)
  for (const [i, entry] of manifest.programmes.entries()) {
    const owner = users[i % users.length]!
    const slug = await uniqueSlug(entry.title, takenSlug)
    slugs.add(slug)

    const programmeId = randomUUID()
    const revisionId = randomUUID()
    const uploadedAt = daysAgo(300 - i * 7)

    await insertRoot({
      programmeId,
      revisionId,
      slug,
      title: entry.title,
      sector: entry.sector,
      ownerUserId: owner.id,
      uploaderDisplayName: owner.display_name,
      uploadedAt,
      description: descriptionFor(entry.title, entry.activities),
    })

    if (entry.name === failedName) {
      // A `failed` row keeps its explanation for 24 h, and `/me` is the only channel left if
      // the tab was closed — the app cannot send mail (§5.9). Written directly: making ingest
      // fail on purpose would need a deliberately broken file, and the row is the artefact
      // the surface renders.
      await db
        .update(revision)
        .set({
          status: 'failed',
          ingest_attempts: 3,
          failure_reason: FAILURE_REASONS.tokenizer,
          failure_detail: 'XerParseError | unexpected record type | TASK row 412 field 7',
        })
        .where(eq(revision.id, revisionId))
      console.log(`  ✗ ${slug} (failed, on purpose)`)
      continue
    }

    const bytes = new Uint8Array(readFileSync(join(CATALOGUE_DIR, entry.file)))
    const outcome = await ingestFromBytes(db, { programmeId, revisionId }, bytes, {
      now: uploadedAt,
    })
    idByName.set(entry.name, { programmeId, revisionId, slug })
    report(slug, outcome)
  }

  console.log('Adding the revision series…')
  const seriesTarget = idByName.get(manifest.revision_series.programme)
  if (seriesTarget) {
    for (const rev of manifest.revision_series.revisions) {
      const revisionId = randomUUID()
      const uploadedAt = daysAgo(120 - rev.rev_no * 28)
      const [owner] = await db
        .select({ id: appUser.id, display_name: appUser.display_name })
        .from(appUser)
        .innerJoin(programme, eq(programme.owner_user_id, appUser.id))
        .where(eq(programme.id, seriesTarget.programmeId))
        .limit(1)

      await db.insert(revision).values({
        id: revisionId,
        programme_id: seriesTarget.programmeId,
        rev_no: rev.rev_no,
        uploaded_at: uploadedAt,
        uploader_display_name: owner?.display_name ?? CONTRIBUTORS[0]!,
        change_note: `Monthly update — data date moved on ${rev.rev_no - 1} month(s).`,
        // Not a root revision: `is_root_rev` is true only when the programme is a root AND
        // `rev_no = 1`, which is exactly what makes the partial dedup index expressible.
        is_root_rev: false,
        terms_version: TERMS_VERSION,
        asserted_at: uploadedAt,
        status: 'pending',
      })

      const bytes = new Uint8Array(readFileSync(join(CATALOGUE_DIR, rev.file)))
      const outcome = await ingestFromBytes(
        db,
        { programmeId: seriesTarget.programmeId, revisionId },
        bytes,
        { now: uploadedAt },
      )
      report(`${seriesTarget.slug} r${rev.rev_no}`, outcome)
    }
  }

  console.log('Adding the fork siblings…')
  for (const [i, fork] of manifest.forks.entries()) {
    const parent = idByName.get(fork.parent)
    if (!parent) continue
    const owner = users[(i + 3) % users.length]!
    const slug = await uniqueSlug(fork.title, takenSlug)
    slugs.add(slug)

    const programmeId = randomUUID()
    const revisionId = randomUUID()
    const uploadedAt = daysAgo(45 - i * 12)

    // The fork edge points at a **Revision**, with the parent Programme denormalised beside
    // it. The revision pointer is the truth and the two can never disagree, because Revisions
    // are immutable and each belongs to exactly one Programme (§2.11).
    const [parentRow] = await db
      .select({ root: programme.root_programme_id })
      .from(programme)
      .where(eq(programme.id, parent.programmeId))
      .limit(1)

    await db.insert(programme).values({
      id: programmeId,
      slug,
      title: fork.title,
      description: 'Forked to try a different sequence. Same scope, same durations.',
      sector: 'highways',
      owner_user_id: owner.id,
      parent_revision_id: parent.revisionId,
      parent_programme_id: parent.programmeId,
      root_programme_id: parentRow?.root ?? parent.programmeId,
      status: 'published',
      created_at: uploadedAt,
    })
    await db.insert(revision).values({
      id: revisionId,
      programme_id: programmeId,
      rev_no: 1,
      uploaded_at: uploadedAt,
      uploader_display_name: owner.display_name,
      // Required on a fork's rev 1 — a fork carries an attribution obligation (§5.8).
      change_note: fork.change_note,
      // A fork's rev 1 is its own rev 1, but the programme is not a root, so this is false.
      is_root_rev: false,
      terms_version: TERMS_VERSION,
      asserted_at: uploadedAt,
      status: 'pending',
    })

    const bytes = new Uint8Array(readFileSync(join(CATALOGUE_DIR, fork.file)))
    const outcome = await ingestFromBytes(db, { programmeId, revisionId }, bytes, {
      now: uploadedAt,
    })
    report(slug, outcome)
  }

  console.log('Tombstoning two programmes, one per class…')
  for (const [name, removalClass] of tombstoneOf) {
    const target = idByName.get(name)
    if (!target) continue
    const removedAt = daysAgo(9)
    await db
      .update(revision)
      .set({
        status: 'tombstoned',
        removal_class: removalClass,
        removed_at: removedAt,
        // Bytes hard-delete, rows never. `bytes_deleted_at` means *public bytes destroyed and
        // CDN purge confirmed*, which is what makes the reconciler a pure SQL predicate.
        bytes_deleted_at: removedAt,
      })
      .where(eq(revision.id, target.revisionId))
    await db
      .update(programme)
      .set({ status: 'tombstoned', current_revision_id: null })
      .where(eq(programme.id, target.programmeId))
    console.log(`  ⊘ ${target.slug} (class ${removalClass})`)
  }

  console.log('Casting votes and bookmarks…')
  await seedCredit(users, [...idByName.values()])

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(programme)
  console.log(`\nDone. ${count} programmes on the shelf.`)
}

async function seedUsers() {
  const rows = CONTRIBUTORS.map((handle, i) => ({
    id: randomUUID(),
    clerk_user_id: `user_seed_${handle}`,
    display_name: handle,
    created_at: daysAgo(400 - i * 30),
  }))
  await db.insert(appUser).values(rows).onConflictDoNothing()
  return await db.select().from(appUser)
}

interface RootInsert {
  programmeId: string
  revisionId: string
  slug: string
  title: string
  description: string
  sector: SectorCode | null
  ownerUserId: string
  uploaderDisplayName: string
  uploadedAt: Date
}

/**
 * The circular-FK batch (§2.10): insert the Programme with a null `current_revision_id`,
 * insert the Revision, and let ingest set the pointer. Two statements rather than one
 * transaction, which is all `neon-http` can do and all this needs — the shelf's inner join
 * cannot see a programme whose `current_revision_id` is still null, so the intermediate state
 * is invisible for free.
 */
async function insertRoot(input: RootInsert) {
  await db
    .insert(programme)
    .values({
      id: input.programmeId,
      slug: input.slug,
      title: input.title,
      description: input.description,
      sector: input.sector,
      owner_user_id: input.ownerUserId,
      // A root's `root_programme_id` self-references, so family queries need no null branch.
      root_programme_id: input.programmeId,
      status: 'published',
      created_at: input.uploadedAt,
    })
    .onConflictDoNothing()

  await db
    .insert(revision)
    .values({
      id: input.revisionId,
      programme_id: input.programmeId,
      rev_no: 1,
      uploaded_at: input.uploadedAt,
      uploader_display_name: input.uploaderDisplayName,
      is_root_rev: true,
      terms_version: TERMS_VERSION,
      asserted_at: input.uploadedAt,
      status: 'pending',
    })
    .onConflictDoNothing()
}

async function seedCredit(users: { id: string }[], programmes: { programmeId: string }[]) {
  const votes: { voter_user_id: string; programme_id: string; created_at: Date }[] = []
  const bookmarks: { user_id: string; programme_id: string; created_at: Date }[] = []

  programmes.forEach((p, i) => {
    // A deterministic spread, so the shelf's vote column has a shape rather than a constant.
    const voterCount = (i * 7) % users.length
    for (let v = 0; v < voterCount; v++) {
      votes.push({
        voter_user_id: users[v]!.id,
        programme_id: p.programmeId,
        created_at: daysAgo(30 - v),
      })
    }
    if (i % 4 === 0) {
      bookmarks.push({
        user_id: users[0]!.id,
        programme_id: p.programmeId,
        created_at: daysAgo(12),
      })
    }
  })

  if (votes.length) await db.insert(programmeVote).values(votes).onConflictDoNothing()
  if (bookmarks.length) await db.insert(bookmark).values(bookmarks).onConflictDoNothing()

  // The counters are denormalised and maintained on write (§10.6), so a seed that inserted
  // the vote rows and stopped would leave the shelf reading zero on every row.
  await db.execute(sql`
    update programme
       set vote_count = (select count(*) from programme_vote v where v.programme_id = programme.id)
  `)

  const uploaderVotes = users.slice(0, 3).flatMap((voter, i) =>
    users
      .filter((u) => u.id !== voter.id)
      .slice(0, 2 + i)
      .map((subject) => ({
        voter_user_id: voter.id,
        subject_user_id: subject.id,
        created_at: daysAgo(20 - i),
      })),
  )
  if (uploaderVotes.length) {
    await db.insert(uploaderVote).values(uploaderVotes).onConflictDoNothing()
  }
  await db.execute(sql`
    update app_user
       set uploader_vote_count =
         (select count(*) from uploader_vote v where v.subject_user_id = app_user.id)
  `)
}

function report(label: string, outcome: { status: string; [k: string]: unknown }) {
  if (outcome.status === 'published') {
    console.log(`  ✓ ${label} (${outcome.activityCount} activities, ${outcome.issues} issues)`)
  } else {
    console.log(`  ! ${label} → ${outcome.status}: ${outcome.reason ?? outcome.detail ?? ''}`)
  }
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(9, 0, 0, 0)
  return d
}

function descriptionFor(title: string, activities: number): string {
  return `${title}. A ${activities.toLocaleString()}-activity programme exported from Primavera P6, published here so anyone can read its shape, its logic and its quality without opening P6.`
}

await main()
