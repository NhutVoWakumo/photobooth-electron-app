import type { JSX } from 'react'
import { getTemplateCopy, type TemplateManifest } from '../templates'
import { FrameArtwork } from './FrameArtwork'
import { t, type Language } from '../i18n'
import { PageShell } from './PageShell'

interface FramePreviewProps {
  language: Language
  template: TemplateManifest
  extraCaptureAllowance: number
  onBack: () => void
  onStart: () => void
}

export function FramePreview({ language, template, extraCaptureAllowance, onBack, onStart }: FramePreviewProps): JSX.Element {
  const copy = getTemplateCopy(language, template)
  return (
    <PageShell className="frame-preview-page" eyebrow={t(language, 'frameSelected')} title={copy.name} description={<>{copy.description} {t(language, 'photoPlan', { min: template.requiredSlots, max: template.requiredSlots + extraCaptureAllowance, required: template.requiredSlots })}</>} backLabel={t(language, 'back')} onBack={onBack} actions={<button className="primary-button" onClick={onStart}>{t(language, 'startSession')}</button>}>
      <div className="frame-preview-art"><FrameArtwork selected template={template} language={language} label={`${copy.name} - ${t(language, 'selectedFramePreview')}`} /></div>
      <div className="frame-preview-copy">
        <dl className="frame-specs"><div><dt>{t(language, 'finalPrint')}</dt><dd>{copy.printLabel}</dd></div><div><dt>{t(language, 'layout')}</dt><dd>{template.rows} × {template.columns}</dd></div><div><dt>{t(language, 'canvas')}</dt><dd>{template.output.width} × {template.output.height} px</dd></div></dl>
      </div>
    </PageShell>
  )
}
