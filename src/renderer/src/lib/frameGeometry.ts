import type { FrameSlotShape } from '../templates'

export type NormalizedPoint = readonly [x: number, y: number]

export function radialShapePoints(shape: 'blob' | 'scallop'): NormalizedPoint[] {
  const points = shape === 'scallop' ? 16 : 10
  const wobble = shape === 'scallop' ? .16 : .08
  return Array.from({ length: points }, (_, index) => {
    const angle = index / points * Math.PI * 2
    const radius = 1 - (index % 2) * wobble
    return [
      .5 + Math.cos(angle) * .5 * radius,
      .5 + Math.sin(angle) * .5 * radius
    ] as const
  })
}

export function shapeClipPath(shape?: FrameSlotShape): string | undefined {
  if (shape === 'circle' || shape === 'ellipse') return 'ellipse(50% 50% at 50% 50%)'
  if (shape === 'heart') return 'polygon(50% 94%, 8% 55%, 3% 32%, 12% 12%, 31% 7%, 50% 24%, 69% 7%, 88% 12%, 97% 32%, 92% 55%)'
  if (shape === 'diamond') return 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)'
  if (shape === 'star') return 'polygon(50% 0, 61% 34%, 98% 35%, 68% 56%, 79% 92%, 50% 70%, 21% 92%, 32% 56%, 2% 35%, 39% 34%)'
  if (shape === 'ticket') return 'polygon(0 0, 100% 0, 100% 36%, 92% 50%, 100% 64%, 100% 100%, 0 100%, 0 64%, 8% 50%, 0 36%)'
  if (shape === 'blob' || shape === 'scallop') return `polygon(${radialShapePoints(shape).map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`).join(', ')})`
  return undefined
}

export function shapeBorderRadius(shape?: FrameSlotShape, radius = .08): string | undefined {
  if (shape === 'rounded') return `${radius * 100}%`
  if (shape === 'arch') return '50% 50% 0 0 / 35% 35% 0 0'
  return undefined
}
