import type { ScanPersonalData, ScanResource } from '@/lib/xer'

/**
 * The disclosure panel's arithmetic (§7.8), separated from its markup so it can be tested.
 *
 * The panel **enumerates values, not counts**, for the closed sets — nobody acts on "15
 * resources"; they act on recognising a colleague's name — so the only counting done here is
 * the one line §7.8 asks for by name, the resource type summary.
 *
 * Its register is bound by §7.4: it **lists what it finds**, and it never *checks*.
 */

/** Observed P6 values. An unknown code is carried through, never dropped (§2.4). */
const RESOURCE_TYPE_LABELS: Record<string, string> = {
  RT_Labor: 'labour',
  RT_Mat: 'material',
  RT_Equip: 'equipment',
}

export function resourceTypeLabel(code: string): string {
  return RESOURCE_TYPE_LABELS[code] ?? (code === '' ? 'unclassified' : code)
}

/** `8 labour, 6 material, 1 equipment` — most common first, then alphabetically. */
export function summariseResourceTypes(resources: readonly ScanResource[]): string {
  const counts = new Map<string, number>()
  for (const resource of resources) {
    const label = resourceTypeLabel(resource.type)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, n]) => `${n} ${label}`)
    .join(', ')
}

/** The columns §7.8 keeps scanning because they are free when empty and decisive when not. */
export function contactColumns(resource: ScanResource): string[] {
  return [
    resource.email,
    resource.office_phone,
    resource.other_phone,
    resource.employee_code,
  ].filter((value) => value !== '')
}

/**
 * Whether the panel has anything at all to enumerate. Sections with nothing in them do not
 * render, and a panel with no sections says so rather than asserting the file is clean.
 */
export function panelIsEmpty(data: ScanPersonalData): boolean {
  return (
    !data.export_login &&
    !data.export_user_name &&
    !data.project_add_by_name &&
    data.edit_users.length === 0 &&
    data.resources.length === 0 &&
    data.free_text.length === 0
  )
}

/** `5,805 values across: Remarks, Gang, …` — the free-text line, counted and labelled. */
export function freeTextTotal(data: ScanPersonalData): number {
  return data.free_text.reduce((total, entry) => total + entry.rows, 0)
}
