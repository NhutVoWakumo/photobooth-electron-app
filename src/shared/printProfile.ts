export type PaperSize = '4x4' | '4x6' | '4.5x8' | '5x7' | '6x8' | 'A5' | 'A4' | 'Letter'
export type PrintFit = 'contain' | 'cover'

export interface PrinterProfile {
  paper: PaperSize
  marginMm: number
  fit: PrintFit
}

export const paperSizes: Record<PaperSize, { widthMm: number; heightMm: number; label: string }> = {
  '4x4': { widthMm: 101.6, heightMm: 101.6, label: '4 × 4 in' },
  '4x6': { widthMm: 101.6, heightMm: 152.4, label: '4 × 6 in' },
  '4.5x8': { widthMm: 114.3, heightMm: 203.2, label: '4.5 × 8 in' },
  '5x7': { widthMm: 127, heightMm: 177.8, label: '5 × 7 in' },
  '6x8': { widthMm: 152.4, heightMm: 203.2, label: '6 × 8 in' },
  A5: { widthMm: 148, heightMm: 210, label: 'A5' },
  A4: { widthMm: 210, heightMm: 297, label: 'A4' },
  Letter: { widthMm: 215.9, heightMm: 279.4, label: 'US Letter' }
}

export function isPrinterProfile(value: unknown): value is PrinterProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<PrinterProfile>
  return Boolean(profile.paper && Object.hasOwn(paperSizes, profile.paper) &&
    (profile.fit === 'contain' || profile.fit === 'cover') &&
    typeof profile.marginMm === 'number' && Number.isFinite(profile.marginMm) &&
    profile.marginMm >= 0 && profile.marginMm <= 20)
}

export function paperDimensions(profile: PrinterProfile, landscape: boolean): { widthMm: number; heightMm: number } {
  const paper = paperSizes[profile.paper]
  return landscape ? { widthMm: paper.heightMm, heightMm: paper.widthMm } : { widthMm: paper.widthMm, heightMm: paper.heightMm }
}
