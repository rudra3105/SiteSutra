// Shared config for the 7 tower-work stages tracked per site location.
// Used by both the server actions (locations.ts) and the WorkLogsView UI.

export type StageOption = { value: string; label: string; color: 'green' | 'yellow' | 'red' }

export type StageColumn = {
  key: string
  label: string
  statusField: string
  dateField: string
  options: StageOption[]
  isCompleted: (value: string | null | undefined) => boolean
  raField?: string // present only for stages that are billed via RA rounds
}

// Running-Account billing rounds — tracked for Foundation, Erection, Earthing,
// Tack Welding and Stringing (Excavation and OPGW aren't billed via RA rounds).
export const RA_OPTIONS = ['1st RA', '2nd RA', '3rd RA', 'Final']

export const STAGE_COLUMNS: StageColumn[] = [
  {
    key: 'excavation',
    label: 'Excavation',
    statusField: 'excavationStatus',
    dateField: 'excavationDate',
    options: [
      { value: 'COMP', label: 'COMP', color: 'green' },
      { value: 'U/P', label: 'U/P', color: 'yellow' },
      { value: 'ROW', label: 'ROW', color: 'red' },
    ],
    isCompleted: (v) => v === 'COMP',
  },
  {
    key: 'foundation',
    label: 'Foundation',
    statusField: 'foundationStatus',
    dateField: 'foundationDate',
    raField: 'foundationRa',
    options: [
      { value: 'SR', label: 'SR', color: 'green' },
      { value: 'PSNS', label: 'PSNS', color: 'green' },
      { value: 'FDBC', label: 'FDBC', color: 'green' },
      { value: 'PDBC', label: 'PDBC', color: 'green' },
      { value: 'HR', label: 'HR', color: 'green' },
      { value: 'NDS', label: 'NDS', color: 'green' },
      { value: 'ROW', label: 'ROW', color: 'red' },
    ],
    isCompleted: (v) => !!v && v !== 'ROW',
  },
  {
    key: 'erection',
    label: 'Erection',
    statusField: 'erectionStatus',
    dateField: 'erectionDate',
    raField: 'erectionRa',
    options: [
      { value: 'COMP', label: 'COMP', color: 'green' },
      { value: 'U/P', label: 'U/P', color: 'yellow' },
    ],
    isCompleted: (v) => v === 'COMP',
  },
  {
    key: 'earthing',
    label: 'Earthing',
    statusField: 'earthingStatus',
    dateField: 'earthingDate',
    raField: 'earthingRa',
    options: [
      { value: 'COMP', label: 'COMP', color: 'green' },
      { value: 'U/P', label: 'U/P', color: 'yellow' },
    ],
    isCompleted: (v) => v === 'COMP',
  },
  {
    key: 'tackWelding',
    label: 'Tack Welding',
    statusField: 'tackWeldingStatus',
    dateField: 'tackWeldingDate',
    raField: 'tackWeldingRa',
    options: [
      { value: 'COMP', label: 'COMP', color: 'green' },
      { value: 'U/P', label: 'U/P', color: 'yellow' },
    ],
    isCompleted: (v) => v === 'COMP',
  },
  {
    key: 'stringing',
    label: 'Stringing',
    statusField: 'stringingStatus',
    dateField: 'stringingDate',
    raField: 'stringingRa',
    options: [
      { value: 'COMP', label: 'COMP', color: 'green' },
      { value: 'ROW', label: 'ROW', color: 'red' },
    ],
    isCompleted: (v) => v === 'COMP',
  },
  {
    key: 'opgw',
    label: 'OPGW',
    statusField: 'opgwStatus',
    dateField: 'opgwDate',
    options: [
      { value: 'COMP', label: 'COMP', color: 'green' },
      { value: 'ROW', label: 'ROW', color: 'red' },
    ],
    isCompleted: (v) => v === 'COMP',
  },
]

export function stageColumn(key: string) {
  return STAGE_COLUMNS.find((s) => s.key === key)
}
