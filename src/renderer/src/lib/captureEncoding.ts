export async function encodeCapturedCanvas(canvas: HTMLCanvasElement, quality: number): Promise<{ dataUrl: string; previewDataUrl: string }> {
  const thumbnail = document.createElement('canvas')
  const scale = Math.min(1, 480 / Math.max(canvas.width, canvas.height))
  thumbnail.width = Math.max(1, Math.round(canvas.width * scale))
  thumbnail.height = Math.max(1, Math.round(canvas.height * scale))
  const thumbnailContext = thumbnail.getContext('2d', { alpha: false })
  if (!thumbnailContext) throw new Error('Could not create photo preview.')
  thumbnailContext.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height)
  const previewDataUrl = thumbnail.toDataURL('image/jpeg', 0.78)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('JPEG encoding failed.')), 'image/jpeg', quality))
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  return { dataUrl, previewDataUrl }
}
