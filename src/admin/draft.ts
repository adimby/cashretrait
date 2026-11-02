import type { Operator, OperatorId, Tariffs } from '../tariffs/schema'
import type { GenericTable } from '../tariffs/parsers/generic'

/** What the preview edits: one operator's grid, merged onto `current` (the file at `baseSha`) on publish. */
export type Draft = {
  operator: OperatorId
  current: Tariffs
  edited: Operator
  baseSha?: string
  origin: 'parse' | 'generic' | 'manual'
  parserError?: string
  generic?: GenericTable[]
  at: Date
}
