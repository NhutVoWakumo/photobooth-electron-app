/** Photo-slot masks are embedded assets. Their alpha, not their colour, cuts the photo. */
export const MAX_SLOT_MASK_LENGTH = 2_000_000

export function isSlotMask(value: unknown): value is string {
  return typeof value === 'string' && value.length < MAX_SLOT_MASK_LENGTH &&
    (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) || /^data:image\/svg\+xml;charset=utf-8,/.test(value))
}

export function slotMaskStyle(mask?: string): { maskImage?: string; WebkitMaskImage?: string; maskSize?: string; WebkitMaskSize?: string } {
  if (!mask) return {}
  return { maskImage: `url("${mask}")`, WebkitMaskImage: `url("${mask}")`, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }
}

const elements = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'])
const attributes = ['d', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'points', 'transform', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']

/** Import SVG geometry without scripts, remote assets, stylesheets, filters or links. */
export function svgToSlotMask(source: string): string {
  if (source.length > 1_000_000) throw new Error('SVG mask is larger than 1 MB.')
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = document.documentElement
  if (root.localName !== 'svg' || document.querySelector('parsererror')) throw new Error('This is not a valid SVG.')
  const viewBox = root.getAttribute('viewBox')
  const numbers = viewBox?.trim().split(/[\s,]+/).map(Number)
  if (!numbers || numbers.length !== 4 || numbers.some(number => !Number.isFinite(number)) || numbers[2] <= 0 || numbers[3] <= 0) throw new Error('SVG shape needs a valid viewBox.')
  const output = document.implementation.createDocument('http://www.w3.org/2000/svg', 'svg', null)
  const safeRoot = output.documentElement
  safeRoot.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  safeRoot.setAttribute('viewBox', numbers.join(' '))
  safeRoot.setAttribute('preserveAspectRatio', 'none')
  let count = 0
  const copy = (from: Element, to: Element) => {
    for (const child of Array.from(from.children)) {
      if (!elements.has(child.localName)) continue
      if (++count > 500) throw new Error('SVG shape has too many elements.')
      const next = output.createElementNS('http://www.w3.org/2000/svg', child.localName)
      for (const name of attributes) {
        const value = child.getAttribute(name)
        if (value && !/url\s*\(|javascript:|[<>]/i.test(value) && value.length < 200_000) next.setAttribute(name, value)
      }
      const fill = child.getAttribute('fill')
      next.setAttribute('fill', fill === 'none' ? 'none' : 'white')
      if (child.getAttribute('stroke') && child.getAttribute('stroke') !== 'none') next.setAttribute('stroke', 'white')
      to.appendChild(next)
      copy(child, next)
    }
  }
  copy(root, safeRoot)
  if (!count) throw new Error('SVG shape needs paths or basic geometry. Export complex artwork as transparent PNG.')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(safeRoot))}`
}

export type MaskPoint = { x: number; y: number }

/** Closed, smoothed outline in normalized slot coordinates. */
export function drawnSlotMask(input: MaskPoint[] | MaskPoint[][]): string {
  const contours = Array.isArray(input[0]) ? input as MaskPoint[][] : [input as MaskPoint[]]
  if (!contours.length || contours.length > 20) throw new Error('Draw between 1 and 20 closed outlines.')
  const xy = (point: MaskPoint) => `${Math.round(point.x * 1000)} ${Math.round(point.y * 1000)}`
  const midpoint = (a: MaskPoint, b: MaskPoint): MaskPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const paths = contours.map(points => {
    if (points.length < 3) throw new Error('Draw at least three points for each outline.')
    const filtered: MaskPoint[] = []
    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) throw new Error('Shape has a point outside the photo slot.')
      if (!filtered.length || Math.hypot(point.x - filtered.at(-1)!.x, point.y - filtered.at(-1)!.y) > .004) filtered.push(point)
      if (filtered.length >= 1000) break
    }
    if (filtered.length < 3) throw new Error('Draw a larger closed outline.')
    const area = Math.abs(filtered.reduce((sum, point, index) => {
      const next = filtered[(index + 1) % filtered.length]
      return sum + point.x * next.y - next.x * point.y
    }, 0)) / 2
    if (area < .002) throw new Error('The outline is too narrow. Draw around an area, not just a line.')
    const straight = filtered.length <= 8
    const path = straight ? [`M ${xy(filtered[0])}`] : [`M ${xy(midpoint(filtered.at(-1)!, filtered[0]))}`]
    filtered.forEach((point, index) => { if (straight && index > 0) path.push(`L ${xy(point)}`); else if (!straight) path.push(`Q ${xy(point)} ${xy(midpoint(point, filtered[(index + 1) % filtered.length]))}`) })
    path.push('Z')
    return path.join(' ')
  })
  return svgToSlotMask(`<svg viewBox="0 0 1000 1000"><path fill-rule="evenodd" d="${paths.join(' ')}"/></svg>`)
}
