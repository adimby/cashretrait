/** Authored 24px line icons, 2px stroke, round joins. Decorative: labels always carry the meaning. */
const paths: Record<string, string> = {
  // calculator: body + display + keys
  calculer: 'M6 2.5h12a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5ZM8 6h8v3H8ZM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17v.01',
  // three bars of different height on a baseline
  comparer: 'M4 20.5h16M6.5 20.5V12M12 20.5V5M17.5 20.5v-6',
  // fare board: rows with a price column
  tarifs: 'M4 4.5h16v15H4ZM4 9.5h16M4 14.5h16M14 4.5v15',
  // more: three dots
  plus: 'M5 12h.01M12 12h.01M19 12h.01',
  chevron: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  minus: 'M6 12h12',
  add: 'M6 12h12M12 6v12',
  external: 'M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.5h.01',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  // share: tray with an arrow leaving it
  share: 'M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7.5h14V12',
  // a person without account
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  // any operator: three plates side by side
  any: 'M3 8.5h5v7H3ZM9.5 8.5h5v7h-5ZM16 8.5h5v7h-5Z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z',
  offline: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5M12 20h.01',
}

export function Icon({ name, size = 24, filled = false }: { name: keyof typeof paths | string; size?: number; filled?: boolean }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      stroke-width={name === 'plus' ? 3.5 : 2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  )
}
