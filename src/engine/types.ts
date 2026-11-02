export type Tx = { amount: number; fee: number }
export type Fail = { ok: false; reason: 'invalid_amount' | 'below_min' | 'too_large' | 'unavailable' | 'insufficient' }
export type SplitOk = { ok: true; transactions: Tx[]; total: number; single: number | null; savings: number }
export type SplitResult = SplitOk | Fail
export type SplitOpts = { step: number; maxTx: number; minTx: number; maxTxAmount: number }
