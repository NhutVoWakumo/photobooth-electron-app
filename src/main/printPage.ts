/** A single, out-of-flow image cannot create a second printed page. */
export function buildPrintPage(widthMm: number, heightMm: number, marginMm: number, fit: 'contain' | 'cover'): string {
  if (![widthMm, heightMm, marginMm].every(Number.isFinite) || widthMm <= 0 || heightMm <= 0 || marginMm < 0 || marginMm * 2 >= Math.min(widthMm, heightMm)) throw new Error('Invalid print page.')
  if (fit !== 'contain' && fit !== 'cover') throw new Error('Invalid print fit.')
  const contentWidth = widthMm - marginMm * 2 - 0.5
  const contentHeight = heightMm - marginMm * 2 - 0.5
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${widthMm}mm ${heightMm}mm;margin:0}html,body{margin:0;padding:0;width:0;height:0;overflow:hidden}img{position:absolute;display:block;left:${marginMm}mm;top:${marginMm}mm;width:${contentWidth}mm;height:${contentHeight}mm;object-fit:${fit};break-inside:avoid}</style></head><body><img src="photo.jpg"></body></html>`
}

export function printPageSizeMicrons(widthMm: number, heightMm: number): { width: number; height: number } {
  return { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) }
}
