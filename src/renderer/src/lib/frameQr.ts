import type { TemplateManifest } from '../templates'

export interface FrameQrPlacement { x: number; y: number; size: number }

/** If a frame includes a named QR image placeholder, the generated session QR replaces it. */
export function isQrPlaceholderLayer(layer: { id: string; type?: string }): boolean {
  return layer.type === 'image' && /(^|[-_])qr(?:[-_]|$)|qrcode/i.test(layer.id)
}

export function defaultFrameQrPlacement(template: TemplateManifest): FrameQrPlacement {
  if (template.qrPlacement) return clampFrameQrPlacement(template.qrPlacement, template)
  // A compact default in the bottom-right, with a quiet margin from the edge.
  const printWidthMm = template.output.width / template.output.ppi * 25.4
  const size = Math.min(0.35, 0.84 * template.output.height / template.output.width, Math.max(0.08, 15 / printWidthMm * 0.7))
  const height = size * template.output.width / template.output.height
  return { x: 0.975 - size, y: Math.max(0.025, 0.975 - height), size }
}

/** Shrink only previously generated defaults; preserve placements guests customized. */
export function effectiveFrameQrPlacement(saved: FrameQrPlacement | undefined, template: TemplateManifest): FrameQrPlacement {
  if (!saved) return defaultFrameQrPlacement(template)
  if (template.qrPlacement) return clampFrameQrPlacement(saved, template)
  const printWidthMm = template.output.width / template.output.ppi * 25.4
  const oldSize = Math.min(0.35, 0.84 * template.output.height / template.output.width, Math.max(0.15, 15 / printWidthMm))
  const oldHeight = oldSize * template.output.width / template.output.height
  if (Math.abs(saved.size - oldSize) < 0.0001 && Math.abs(saved.x - (0.98 - oldSize)) < 0.0001 && Math.abs(saved.y - Math.max(0.02, 0.98 - oldHeight)) < 0.0001) return defaultFrameQrPlacement(template)
  return clampFrameQrPlacement(saved, template)
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
