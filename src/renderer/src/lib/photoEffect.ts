import type { BoothSettings } from '../types'

export function photoEffectFilter(effect: BoothSettings['photoEffect']): string {
  if (effect === 'monochrome') return 'grayscale(1)'
  if (effect === 'sepia') return 'sepia(0.85) saturate(0.9)'
  return 'none'
}
