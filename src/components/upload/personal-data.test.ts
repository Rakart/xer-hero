import { describe, expect, it } from 'vitest'
import type { ScanPersonalData, ScanResource } from '@/lib/xer'
import {
  contactColumns,
  freeTextTotal,
  panelIsEmpty,
  resourceTypeLabel,
  summariseResourceTypes,
} from './personal-data'

const resource = (over: Partial<ScanResource> = {}): ScanResource => ({
  name: 'A Person',
  type: 'RT_Labor',
  email: '',
  office_phone: '',
  other_phone: '',
  employee_code: '',
  has_notes: false,
  ...over,
})

const empty: ScanPersonalData = {
  export_login: null,
  export_user_name: null,
  project_add_by_name: null,
  edit_users: [],
  resources: [],
  free_text: [],
  truncated: false,
}

describe('resourceTypeLabel', () => {
  it('reads the three observed P6 codes', () => {
    expect(resourceTypeLabel('RT_Labor')).toBe('labour')
    expect(resourceTypeLabel('RT_Mat')).toBe('material')
    expect(resourceTypeLabel('RT_Equip')).toBe('equipment')
  })

  it('carries an unknown code through rather than dropping it (§2.4)', () => {
    expect(resourceTypeLabel('RT_Something')).toBe('RT_Something')
  })
})

describe('summariseResourceTypes', () => {
  it('reads as the one counted line §7.8 asks for', () => {
    const resources = [
      ...Array.from({ length: 8 }, () => resource({ type: 'RT_Labor' })),
      ...Array.from({ length: 6 }, () => resource({ type: 'RT_Mat' })),
      resource({ type: 'RT_Equip' }),
    ]
    expect(summariseResourceTypes(resources)).toBe('8 labour, 6 material, 1 equipment')
  })

  it('is empty when there are no resources', () => {
    expect(summariseResourceTypes([])).toBe('')
  })
})

describe('contactColumns', () => {
  it('is empty on the measured-empty case, which is every real fixture', () => {
    expect(contactColumns(resource())).toEqual([])
  })

  it('lists whatever a P6 database wired to HR actually filled in', () => {
    expect(contactColumns(resource({ email: 'a@b.c', employee_code: 'E-12' }))).toEqual([
      'a@b.c',
      'E-12',
    ])
  })
})

describe('panelIsEmpty', () => {
  it('is true only when every section is empty', () => {
    expect(panelIsEmpty(empty)).toBe(true)
    expect(panelIsEmpty({ ...empty, export_login: 'admin' })).toBe(false)
    expect(panelIsEmpty({ ...empty, resources: [resource()] })).toBe(false)
  })
})

describe('freeTextTotal', () => {
  it('adds the rows across the tables that carry free text', () => {
    expect(
      freeTextTotal({
        ...empty,
        free_text: [
          { table: 'RSRC', field: 'rsrc_notes', rows: 1 },
          { table: 'UDFVALUE', field: 'udf_text', rows: 5804 },
        ],
      }),
    ).toBe(5805)
  })
})
