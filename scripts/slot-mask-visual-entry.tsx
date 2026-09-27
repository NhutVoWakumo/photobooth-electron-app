import { createRoot } from 'react-dom/client'
import { SlotMaskEditor } from '../src/renderer/src/components/SlotMaskEditor'
import { FrameArtwork } from '../src/renderer/src/components/FrameArtwork'
import { renderTemplate } from '../src/renderer/src/lib/renderTemplate'
import { referenceFrames } from '../src/renderer/src/referenceFrames'

const frame = referenceFrames[0]
createRoot(document.getElementById('root')!).render(<SlotMaskEditor language="en" slot={frame.slots[0]} template={frame} onApply={(mask, bounds) => { (window as typeof window & { __maskResult?: unknown }).__maskResult = { mask, bounds } }} onArtworkImport={() => undefined} onClose={() => undefined} />)
const photo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#3fd4ca"/><stop offset="1" stop-color="#163286"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/></svg>')}`
createRoot(document.getElementById('photo-preview')!).render(<FrameArtwork template={frame} photos={[photo, photo]} language="en" />)
;(window as typeof window & { __renderReference?: () => Promise<number[][]> }).__renderReference = async () => {
  const output = await renderTemplate({ eventName: '', photos: [photo, photo], template: frame, outputJpegQuality: .95 })
  const image = new Image()
  image.src = output
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 600; canvas.height = 1800
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  return [[300, 300], [300, 1030], [300, 700]].map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3))
}
