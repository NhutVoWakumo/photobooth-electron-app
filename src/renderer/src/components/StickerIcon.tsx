import type { CSSProperties, JSX } from 'react'
import type { FrameStickerKind } from '../templates'

interface StickerIconProps {
  kind: FrameStickerKind
  color: string
  secondaryColor: string
  stroke: string
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

export function StickerIcon({ kind, color, secondaryColor, stroke, strokeWidth = 2, className, style }: StickerIconProps): JSX.Element {
  const common = { stroke, strokeWidth, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, vectorEffect: 'non-scaling-stroke' as const }
  return <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true">
    {kind === 'heart' && <path d="M50 88C39 76 11 61 9 35 7 14 33 7 50 29 67 7 93 14 91 35 89 61 61 76 50 88Z" fill={color} {...common} />}
    {kind === 'sparkle' && <><path d="M50 5 61 37 94 50 61 63 50 95 39 63 6 50 39 37Z" fill={color} {...common} /><circle cx="78" cy="20" r="7" fill={secondaryColor} {...common} /></>}
    {kind === 'flower' && <><g fill={color} {...common}>{[0, 72, 144, 216, 288].map(angle => <ellipse key={angle} cx="50" cy="25" rx="14" ry="23" transform={`rotate(${angle} 50 50)`} />)}</g><circle cx="50" cy="50" r="15" fill={secondaryColor} {...common} /></>}
    {kind === 'bow' && <><path d="M46 44C31 19 8 18 10 42c1 16 17 20 36 12M54 44c15-25 38-26 36-2-1 16-17 20-36 12" fill={color} {...common} /><path d="m40 56-17 31 28-18 26 18-17-31" fill={color} {...common} /><rect x="40" y="39" width="20" height="24" rx="7" fill={secondaryColor} {...common} /></>}
    {kind === 'smile' && <><circle cx="50" cy="50" r="40" fill={color} {...common} /><circle cx="36" cy="42" r="5" fill={stroke} /><circle cx="64" cy="42" r="5" fill={stroke} /><path d="M31 59c8 17 30 17 38 0" fill="none" {...common} /></>}
    {kind === 'music' && <><path d="M38 21v49M38 31l40-9v43" fill="none" {...common} strokeWidth={7} /><ellipse cx="25" cy="73" rx="15" ry="11" fill={color} {...common} /><ellipse cx="65" cy="68" rx="15" ry="11" fill={secondaryColor} {...common} /></>}
    {kind === 'cloud' && <path d="M25 75C7 75 7 49 25 46c2-22 32-29 43-11 23-3 30 29 10 38Z" fill={color} {...common} />}
    {kind === 'bolt' && <path d="M54 4 20 55h25l-5 41 40-59H55Z" fill={color} {...common} />}
    {kind === 'cherry' && <><path d="M48 51C50 30 57 19 72 12M53 32C42 22 32 18 23 21" fill="none" {...common} strokeWidth={5} /><circle cx="34" cy="68" r="20" fill={color} {...common} /><circle cx="69" cy="68" r="20" fill={secondaryColor} {...common} /></>}
    {kind === 'star' && <path d="m50 5 13 29 32 3-24 22 7 32-28-16-28 16 7-32L5 37l32-3Z" fill={color} {...common} />}
  </svg>
}
