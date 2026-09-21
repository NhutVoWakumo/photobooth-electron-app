import type { JSX } from 'react'
import { getTemplateCopy, type TemplateManifest } from '../templates'
import { FrameArtwork } from './FrameArtwork'
import { t, type Language } from '../i18n'

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
    <section className="frame-preview-page" aria-labelledby="frame-preview-title">
      <div className="frame-preview-art"><FrameArtwork selected template={template} language={language} label={`${copy.name} - ${t(language, 'selectedFramePreview')}`} /></div>
      <div className="frame-preview-copy">
        <p className="eyebrow">{t(language, 'frameSelected')}</p>
        <h1 id="frame-preview-title">{copy.name}</h1>
        <p>{copy.description} {t(language, 'photoPlan', { min: template.requiredSlots, max: template.requiredSlots + extraCaptureAllowance, required: template.requiredSlots })}</p>
        <dl className="frame-specs"><div><dt>{t(language, 'finalPrint')}</dt><dd>{copy.printLabel}</dd></div><div><dt>{t(language, 'layout')}</dt><dd>{template.rows} × {template.columns}</dd></div><div><dt>{t(language, 'canvas')}</dt><dd>{template.output.width} × {template.output.height} px</dd></div></dl>
        <div className="action-row"><button className="secondary-button" onClick={onBack}>{t(language, 'chooseAnother')}</button><button className="primary-button" onClick={onStart}>{t(language, 'startSession')}</button></div>
      </div>
    </section>
  )
}
