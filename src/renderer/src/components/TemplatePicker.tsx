import type { CSSProperties, JSX } from 'react'
import { getTemplateCopy, type TemplateManifest } from '../templates'
import { FrameArtwork } from './FrameArtwork'
import { t, tr, type Language } from '../i18n'

interface TemplatePickerProps {
  language: Language
  templates: TemplateManifest[]
  onChoose: (template: TemplateManifest) => void
  onBack: () => void
}

export function TemplatePicker({ language, templates, onChoose, onBack }: TemplatePickerProps): JSX.Element {
  return (
    <section className="template-picker" aria-labelledby="template-picker-title">
      <div className="picker-heading">
        <p className="picker-index">01 / {String(templates.length).padStart(2, '0')}</p>
        <h1 id="template-picker-title">{t(language, 'framePickerTitle')}</h1>
        <p>{t(language, 'framePickerHelp')}</p>
      </div>
      <div className="template-list" style={{ '--frame-count': templates.length } as CSSProperties}>
        {templates.map((template, index) => (
          <button className="template-card" key={template.id} onClick={() => onChoose(template)}>
            <span className="template-card-number">0{index + 1}</span>
            <span className="template-card-art"><FrameArtwork template={template} language={language} label={t(language, 'selectedFramePreview')} /></span>
            <span className="template-card-copy"><strong>{getTemplateCopy(language, template).name}</strong><small>{getTemplateCopy(language, template).description}</small><em>{template.requiredSlots === 1 ? tr(language, '1 ảnh', '1 photo') : t(language, 'photoCount', { count: template.requiredSlots })} · {getTemplateCopy(language, template).printLabel}</em><b>{tr(language, 'Chọn khung', 'Choose frame')}</b></span>
          </button>
        ))}
      </div>
      <button className="back-link" onClick={onBack}>← {t(language, 'back')}</button>
    </section>
  )
}
