import type { TemplateManifest } from '../templates'

const loadedFamilies = new Set<string>()

/** Registers fonts embedded in a frame locally; never requests network access. */
export async function loadFrameFonts(template: TemplateManifest): Promise<void> {
  await Promise.all((template.fontAssets ?? []).map(async font => {
    if (loadedFamilies.has(font.family) || !('fonts' in document)) return
    const face = new FontFace(font.family, `url(${font.src})`)
    await face.load()
    document.fonts.add(face)
    loadedFamilies.add(font.family)
  }))
}
