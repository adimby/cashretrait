import { z } from 'zod'

export const OPERATORS = ['mvola', 'airtel', 'orange'] as const
export type OperatorId = typeof OPERATORS[number]
export const OPERATIONS = ['withdrawal', 'withdrawal_non_customer', 'transfer_same', 'transfer_same_app', 'transfer_other_op', 'transfer_non_customer'] as const
export type OperationKey = typeof OPERATIONS[number]
export type Tier = { min: number; max: number } & ({ fee: number } | { feePercent: number })
export type FeeTable = Tier[]
export type Operator = {
  name: string
  source: { url: string; type: 'html' | 'pdf'; publishedAt: string | null }
  limits: { minTx: number; maxTx: number; maxBalance: number }
  fees: Partial<Record<OperationKey, FeeTable>>
}
export type Tariffs = { schemaVersion: 1; updatedAt: string; operators: Record<OperatorId, Operator> }
export const SCHEMA_VERSION = 1

const int = z.number().int().nonnegative()
const TierSchema = z
  .object({ min: int, max: int, fee: int.optional(), feePercent: z.number().nonnegative().optional() })
  .strict()
  .refine((t) => t.min <= t.max, { message: 'min > max' })
  .refine((t) => (t.fee === undefined) !== (t.feePercent === undefined), { message: 'need exactly one of fee/feePercent' })

const FeeTableSchema = z.array(TierSchema)
const feesShape = Object.fromEntries(OPERATIONS.map((k) => [k, FeeTableSchema.optional()]))

/** Absolute http(s) URL only: it is rendered as a link in the app (no javascript:, data:…). */
const HttpUrl = z.string().refine((s) => {
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}, { message: 'URL http(s) attendue' })

const OperatorSchema = z.object({
  name: z.string(),
  source: z.object({ url: HttpUrl, type: z.enum(['html', 'pdf']), publishedAt: z.string().nullable() }).strict(),
  limits: z.object({ minTx: int, maxTx: int, maxBalance: int }).strict(),
  fees: z.object(feesShape).strict(),
}).strict()

export const TariffsSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  operators: z.object({ mvola: OperatorSchema, airtel: OperatorSchema, orange: OperatorSchema }).strict(),
}).strict() as unknown as z.ZodType<Tariffs>
