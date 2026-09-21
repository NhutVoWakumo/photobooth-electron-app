import { useEffect, useState, type JSX } from 'react'
import { renderPrintSheet, renderTemplate, type PrintSheet } from '../lib/renderTemplate'
import { getTemplateCopy, type TemplateManifest } from '../templates'
import type { BoothSettings } from '../types'
import { t, tr } from '../i18n'

interface StripPreviewProps {
  captures: string[]
  assignments: Array<string | null>
  photos: string[]
  settings: BoothSettings
  template: TemplateManifest
}

export function StripPreview({ captures, assignments, photos, settings, template }: StripPreviewProps): JSX.Element {
  const copy = getTemplateCopy(settings.language, template)
  const [strip, setStrip] = useState<string | null>(null)
  const [printSheet, setPrintSheet] = useState<PrintSheet | null>(null)
  const [previewMode, setPreviewMode] = useState<'final' | 'print'>('final')
  const [status, setStatus] = useState<'rendering' | 'ready' | 'saving' | 'saved' | 'error'>('rendering')
  const [message, setMessage] = useState(tr(settings.language, 'Đang render khung ảnh…', 'Rendering your strip…'))

  useEffect(() => {
    let cancelled = false
    setStatus('rendering')
    setStrip(null)
    setPrintSheet(null)
    setPreviewMode('final')
    setMessage(tr(settings.language, 'Đang render khung ảnh…', 'Rendering your strip…'))

    void renderTemplate({ eventName: settings.eventName, photos, template, outputJpegQuality: settings.outputJpegQuality })
      .then(async output => {
        const nextPrintSheet = await renderPrintSheet(output, template, settings.outputJpegQuality)
        if (cancelled) return
        setStrip(output)
        setPrintSheet(nextPrintSheet)
        setStatus('ready')
        setMessage(t(settings.language, 'finalReadyToSave'))
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        setMessage(tr(settings.language, 'Không thể render khung ảnh. Hãy chụp lại phiên này.', 'The strip could not be rendered. Retake this session.'))
      })

    return () => { cancelled = true }
  }, [photos, settings.eventName, settings.language, settings.outputJpegQuality, template])

  const saveStrip = async () => {
    if (!strip || !printSheet) return
    if (!window.booth) {
      setStatus('error')
      setMessage(tr(settings.language, 'Chỉ có thể lưu trong ứng dụng Electron desktop.', 'Saving is available only in the Electron desktop app.'))
      return
    }

    setStatus('saving')
    setMessage(t(settings.language, 'savingSession'))
    try {
      const slotAssignments = Object.fromEntries(template.slots.flatMap((slot, index) => {
        const photo = assignments[index]
        const captureIndex = photo ? captures.indexOf(photo) : -1
        return captureIndex >= 0 ? [[slot.id, `capture-${captureIndex + 1}`]] : []
      }))
      await window.booth.saveSession({
        eventName: settings.eventName,
        photos: captures,
        strip,
        printSheet: printSheet.dataUrl,
        printLayout: {
          id: printSheet.layoutId,
          width: printSheet.width,
          height: printSheet.height,
          copiesPerSheet: printSheet.copiesPerSheet
        },
        templateId: template.id,
        slotAssignments
      })
      setStatus('saved')
      setMessage(t(settings.language, 'sessionSaved'))
    } catch {
      setStatus('error')
      setMessage(tr(settings.language, 'Không thể lưu phiên này. Ảnh vẫn đang mở, hãy thử lại.', 'Could not save this session. Your photos are still open; try again.'))
    }
  }

  const showingPrintSheet = previewMode === 'print'
  const previewSource = showingPrintSheet ? printSheet?.dataUrl : strip
  const previewAspectRatio = showingPrintSheet && printSheet
    ? `${printSheet.width} / ${printSheet.height}`
    : `${template.output.width} / ${template.output.height}`

  return (
    <div className="strip-result">
      <div className="result-preview-tabs" role="group" aria-label={t(settings.language, 'printLayout')}>
        <button aria-pressed={previewMode === 'final'} className={previewMode === 'final' ? 'selected' : ''} onClick={() => setPreviewMode('final')}>{t(settings.language, 'finalPhoto')}</button>
        <button aria-pressed={previewMode === 'print'} className={previewMode === 'print' ? 'selected' : ''} disabled={!printSheet} onClick={() => setPreviewMode('print')}>{t(settings.language, 'printSheet')}</button>
      </div>
      <div className="strip-canvas" style={{ aspectRatio: previewAspectRatio }}>
        {previewSource ? <img alt={`${showingPrintSheet ? t(settings.language, 'printSheet') : copy.name} - ${tr(settings.language, 'khung ảnh đã render', 'rendered photobooth frame')}`} src={previewSource} /> : <div className="strip-skeleton" aria-busy="true" />}
      </div>
      {printSheet && <p className="print-layout-note">{printSheet.copiesPerSheet === 2 ? t(settings.language, 'twoUpPrintHelp') : t(settings.language, 'singlePrintHelp')}<br /><span>{t(settings.language, 'copiesPerSheet', { count: printSheet.copiesPerSheet })}</span></p>}
      <p className={status === 'error' ? 'save-status error' : 'save-status'} role="status">{message}</p>
      {status !== 'saved' && <button className="primary-button" disabled={!strip || !printSheet || status === 'saving'} onClick={() => void saveStrip()}>{status === 'saving' ? tr(settings.language, 'Đang lưu…', 'Saving…') : t(settings.language, 'saveSession')}</button>}
    </div>
  )
}
