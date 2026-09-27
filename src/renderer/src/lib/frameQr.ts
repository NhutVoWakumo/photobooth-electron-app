import type { TemplateManifest } from '../templates'

export interface FrameQrPlacement { x: number; y: number; size: number }

export function defaultFrameQrPlacement(template: TemplateManifest): FrameQrPlacement {
  if (template.qrPlacement) return clampFrameQrPlacement(template.qrPlacement, template)
  // About 15 mm on paper: smaller codes can look elegant on screen but may
  // become unreliable when printed, especially on a 2-inch strip.
  const printWidthMm = template.output.width / template.output.ppi * 25.4
  const size = Math.min(0.35, 0.84 * template.output.height / template.output.width, Math.max(0.15, 15 / printWidthMm))
  const height = size * template.output.width / template.output.height
  return { x: 0.98 - size, y: Math.max(0.02, 0.98 - height), size }
}

export function clampFrameQrPlacement(value: FrameQrPlacement, template: TemplateManifest): FrameQrPlacement {
  const maximumSize = Math.min(0.35, 0.84 * template.output.height / template.output.width)
  const size = Math.max(Math.min(0.08, maximumSize), Math.min(maximumSize, Number.isFinite(value.size) ? value.size : 0.15))
  const height = size * template.output.width / template.output.height
  const quietZoneX = size * 0.09
  const quietZoneY = height * 0.09
  return {
    x: Math.max(quietZoneX, Math.min(1 - size - quietZoneX, Number.isFinite(value.x) ? value.x : 0)),
    y: Math.max(quietZoneY, Math.min(1 - height - quietZoneY, Number.isFinite(value.y) ? value.y : 0)),
    size
  }
}
