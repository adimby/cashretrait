const NBSP = ' '

/** 1234567 → '1 234 567' with non-breaking spaces (amounts never wrap mid-number). */
export function formatNumber(n: number): string {
  const r = Math.round(n)
  const digits = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return (r < 0 ? '-' : '') + digits
}

/** 1000000 → '1 000 000 Ar' */
export function formatAr(n: number): string {
  return formatNumber(n) + NBSP + 'Ar'
}

/** '2026-11-02' or ISO datetime → '02/11/2026' (numeric: same in FR and MG). */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
