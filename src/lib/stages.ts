// Shared config for the 7 tower-work stages tracked per site location.
// Used by both the server actions (locations.ts) and the WorkLogsView UI.

export type StageOption = { value: string; label: string; color: 'green' | 'yellow' | 'red' | 'purple' }

export type StageColumn = {
  key: string
  label: string
  statusField: string
  dateField: string
  options: StageOption[]
  isCompleted: (value: string | null | undefined) => boolean
  raField?: string // present only for stages that are billed via RA rounds
  // 'span' — quantities for this stage (Total/Completed/Balance/Billed) are measured
  // by summing each tower's span (conductor length) instead of counting towers.
  measureBy?: 'span'
}

// Every stage column keeps this same base set of statuses — fixed, not
// removable or renameable from the UI. Columns may layer their own
// domain-specific values (e.g. Foundation's SR/PSNS/...) on top, and site
// admins can add further custom values per column (see customStageOptions
// in the schema) the same way custom billing options work.
export const FIXED_STAGE_OPTIONS: StageOption[] = [
  { value: 'COMP',  label: 'COMP',  color: 'green' },
  { value: 'U/P',   label: 'U/P',   color: 'yellow' },
  { value: 'CLEAR', label: 'CLEAR', color: 'purple' },
  { value: 'ROW',   label: 'ROW',   color: 'red' },
]

function withFixedOptions(extra: StageOption[] = []): StageOption[] {
  const extraOnly = extra.filter((o) => !FIXED_STAGE_OPTIONS.some((f) => f.value === o.value))
  return [...FIXED_STAGE_OPTIONS, ...extraOnly]
}

// A value counts as "completed" unless it's one of the fixed non-complete
// markers (U/P, CLEAR, ROW) or empty. That means COMP counts, each column's
// own built-in extras (e.g. Foundation's SR/PSNS/...) count, and — since a
// custom status added via "Statuses" is never named U/P/CLEAR/ROW — any
// custom status added to any column counts as completed too.
function defaultIsCompleted(v: string | null | undefined) {
  return !!v && v !== 'U/P' && v !== 'CLEAR' && v !== 'ROW'
}

export const STAGE_COLUMNS: StageColumn[] = [
  {
    key: 'excavation',
    label: 'Excavation',
    statusField: 'excavationStatus',
    dateField: 'excavationDate',
    options: withFixedOptions(),
    isCompleted: defaultIsCompleted,
  },
  {
    key: 'foundation',
    label: 'Foundation',
    statusField: 'foundationStatus',
    dateField: 'foundationDate',
    raField: 'foundationRa',
    options: withFixedOptions([
      { value: 'SR', label: 'SR', color: 'green' },
      { value: 'PSNS', label: 'PSNS', color: 'green' },
      { value: 'FDBC', label: 'FDBC', color: 'green' },
      { value: 'PDBC', label: 'PDBC', color: 'green' },
      { value: 'HR', label: 'HR', color: 'green' },
      { value: 'NDS', label: 'NDS', color: 'green' },
    ]),
    isCompleted: defaultIsCompleted,
  },
  {
    key: 'erection',
    label: 'Erection',
    statusField: 'erectionStatus',
    dateField: 'erectionDate',
    raField: 'erectionRa',
    options: withFixedOptions(),
    isCompleted: defaultIsCompleted,
  },
  {
    key: 'earthing',
    label: 'Earthing',
    statusField: 'earthingStatus',
    dateField: 'earthingDate',
    raField: 'earthingRa',
    options: withFixedOptions(),
    isCompleted: defaultIsCompleted,
  },
  {
    key: 'tackWelding',
    label: 'Tack Welding',
    statusField: 'tackWeldingStatus',
    dateField: 'tackWeldingDate',
    raField: 'tackWeldingRa',
    options: withFixedOptions(),
    isCompleted: defaultIsCompleted,
  },
  {
    key: 'stringing',
    label: 'Stringing',
    statusField: 'stringingStatus',
    dateField: 'stringingDate',
    raField: 'stringingRa',
    measureBy: 'span',
    options: withFixedOptions(),
    isCompleted: defaultIsCompleted,
  },
  {
    key: 'opgw',
    label: 'OPGW',
    statusField: 'opgwStatus',
    dateField: 'opgwDate',
    raField: 'opgwRa',
    measureBy: 'span',
    options: withFixedOptions(),
    isCompleted: defaultIsCompleted,
  },
]

export function stageColumn(key: string) {
  return STAGE_COLUMNS.find((s) => s.key === key)
}
