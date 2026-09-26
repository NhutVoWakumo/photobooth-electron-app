import { useEffect, useRef, useState, type JSX } from 'react'
import { SettingsPanel } from './components/SettingsPanel'
import { FrameStudio } from './components/FrameStudio'
import { TemplatePicker } from './components/TemplatePicker'
import { KioskMotion } from './components/KioskMotion'
import { SessionHome } from './components/SessionHome'
import { SessionList } from './components/SessionList'
import { FrameSetEditor } from './components/SessionDetail'
import { SessionFrames } from './components/SessionFrames'
import { SlotCapture } from './components/SlotCapture'
import { useCamera } from './hooks/useCamera'
import { deleteStoredSession, listStoredSessions, saveStoredSession } from './lib/sessionStore'
import { getTemplate, templates, type TemplateManifest } from './templates'
import { defaultSettings, type BoothSession, type BoothSettings, type BoothStage, type SessionFrameSet } from './types'
import { t } from './i18n'
import { referenceFrames } from './referenceFrames'

const storageKey = 'luma-booth-settings-v2'

function normalizeSettings(value: unknown): BoothSettings {
  try {
    const saved = ((typeof value === 'string' ? JSON.parse(value) : value) ?? {}) as Partial<BoothSettings>
    const savedCustomFrames = Array.isArray(saved.customFrames) ? saved.customFrames.filter(frame => frame && typeof frame.id === 'string' && Array.isArray(frame.slots) && frame.theme) : []
    const customFrames = [...referenceFrames, ...savedCustomFrames.filter(frame => !referenceFrames.some(reference => reference.id === frame.id))]
    const knownFrameIds = new Set([...templates, ...customFrames].map(frame => frame.id))
    const storedEnabled = Array.isArray(saved.enabledFrameIds) ? saved.enabledFrameIds.filter((id): id is string => typeof id === 'string' && knownFrameIds.has(id)) : defaultSettings.enabledFrameIds
    const enabledFrameIds = [...new Set([...storedEnabled, ...referenceFrames.map(frame => frame.id)])]
    // Migrate the previous defaults once; other custom timing values survive.
    const legacyDefaults = !saved.timingDefaultsVersion
    const countdownSeconds = legacyDefaults && saved.countdownSeconds === 3 ? 10 : (saved.countdownSeconds ?? defaultSettings.countdownSeconds)
    const postCaptureReviewMs = legacyDefaults && saved.postCaptureReviewMs === 3000 ? 2000 : (saved.postCaptureReviewMs ?? defaultSettings.postCaptureReviewMs)
    return { ...defaultSettings, ...saved, countdownSeconds, postCaptureReviewMs, timingDefaultsVersion: 2, customFrames, enabledFrameIds: enabledFrameIds.length > 0 ? enabledFrameIds : defaultSettings.enabledFrameIds }
  } catch { return defaultSettings }
}

function readSettings(): BoothSettings {
  return normalizeSettings(localStorage.getItem(storageKey) ?? '{}')
}

function newSession(index: number): BoothSession {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: `Session ${String(index + 1).padStart(2, '0')}`, createdAt: now, updatedAt: now, frames: [] }
}

export function App(): JSX.Element {
  const appRef = useRef<HTMLElement>(null)
  const [settings, setSettings] = useState<BoothSettings>(readSettings)
  const [settingsReady, setSettingsReady] = useState(() => !window.booth)
  const [stage, setStage] = useState<BoothStage>('idle')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'general' | 'frames'>('general')
  const [studioFrame, setStudioFrame] = useState<TemplateManifest | null | undefined>(undefined)
  const [sessions, setSessions] = useState<BoothSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState(0)
  const [storageStatus, setStorageStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const camera = useCamera()

  useEffect(() => {
    if (!settingsReady) return
    localStorage.setItem(storageKey, JSON.stringify(settings))
    void window.booth?.saveSettings(settings)
  }, [settings, settingsReady])
  useEffect(() => {
    if (!window.booth) return
    void window.booth.loadSettings().then(saved => {
      setSettings(normalizeSettings(saved ?? {}))
    }).catch(() => undefined).finally(() => setSettingsReady(true))
  }, [])
  useEffect(() => { void listStoredSessions().then(value => { setSessions(current => [...value, ...current.filter(session => !value.some(stored => stored.id === session.id))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); setStorageStatus('ready') }).catch(() => setStorageStatus('error')) }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [stage, activeFrameId])

  const availableTemplates = [...templates, ...settings.customFrames].filter(template => settings.enabledFrameIds.includes(template.id))
  const activeSession = sessions.find(session => session.id === activeSessionId) ?? null
  const activeFrame = activeSession?.frames.find(frame => frame.id === activeFrameId) ?? null
  const activeTemplate = activeFrame ? (() => { try { return getTemplate(activeFrame.templateId, settings.customFrames) } catch { return availableTemplates[0] ?? templates[0] } })() : availableTemplates[0] ?? templates[0]

  const persistSession = (session: BoothSession) => {
    setSessions(current => [session, ...current.filter(item => item.id !== session.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    // Let React paint the captured preview before cloning a large session over IPC.
    window.setTimeout(() => {
      void saveStoredSession(session).catch(() => setStorageStatus('error'))
    }, 50)
  }
  const createSession = () => {
    const session = newSession(sessions.length)
    persistSession(session)
    setActiveSessionId(session.id)
    setStage('session-detail')
  }
  const openSession = (session: BoothSession) => { setActiveSessionId(session.id); setActiveFrameId(null); setStage('session-detail') }
  const removeSession = (session: BoothSession) => {
    if (!window.confirm(settings.language === 'vi' ? `Xóa “${session.name}” và toàn bộ ảnh trong phiên này?` : `Delete “${session.name}” and every photo in it?`)) return
    setSessions(current => current.filter(item => item.id !== session.id))
    if (activeSessionId === session.id) setActiveSessionId(null)
    void deleteStoredSession(session.id).catch(() => setStorageStatus('error'))
  }
  const beginNewFrame = () => { setActiveFrameId(null); setStage('template-picker') }
  const createFrameFromTemplate = (template: TemplateManifest) => {
    if (!activeSession) return
    const now = new Date().toISOString()
    const frame: SessionFrameSet = { id: crypto.randomUUID(), templateId: template.id, createdAt: now, updatedAt: now, status: 'draft', photos: [], assignments: Array.from({ length: template.requiredSlots }, () => null), slotPositions: Array.from({ length: template.requiredSlots }, () => 50), slotTransforms: Array.from({ length: template.requiredSlots }, () => ({ x: 0, y: 0, scale: 1 })) }
    persistSession({ ...activeSession, frames: [frame, ...activeSession.frames], updatedAt: now })
    setActiveFrameId(frame.id)
    void captureSlot(0)
  }
  const selectCamera = (cameraId: string) => {
    const selected = camera.devices.find(device => device.id === cameraId)
    setSettings(current => ({ ...current, cameraId, cameraName: selected?.label ?? current.cameraName }))
  }
  const openStudio = (frame?: TemplateManifest) => {
    setSettingsTab('frames')
    if (!frame) return setStudioFrame(null)
    setStudioFrame(frame.builtIn ? { ...structuredClone(frame), id: `custom-${crypto.randomUUID()}`, name: `${frame.name} remix`, builtIn: false, createdAt: new Date().toISOString() } : structuredClone(frame))
  }
  const saveStudioFrame = (frame: TemplateManifest) => {
    setSettings(current => {
      const exists = current.customFrames.some(item => item.id === frame.id)
      const customFrames = exists ? current.customFrames.map(item => item.id === frame.id ? frame : item) : [...current.customFrames, frame]
      return { ...current, customFrames, enabledFrameIds: current.enabledFrameIds.includes(frame.id) ? current.enabledFrameIds : [...current.enabledFrameIds, frame.id] }
    })
    setStudioFrame(undefined)
  }
  const captureSlot = async (slotIndex: number) => {
    const selected = await camera.startCamera(settings.cameraId || undefined)
    if (selected) setSettings(current => ({ ...current, cameraId: selected.id, cameraName: selected.label }))
    setActiveSlot(slotIndex)
    setStage('slot-capture')
  }
  const acceptCapture = (dataUrl: string, previewDataUrl: string, aspectRatio: number, slotIndex = activeSlot) => {
    if (!activeSession || !activeFrame) return
    const now = new Date().toISOString()
    const photo = { id: crypto.randomUUID(), dataUrl, previewDataUrl, capturedAt: now, pinned: false, slotAspectRatio: aspectRatio }
    const assignments = [...activeFrame.assignments]
    assignments[slotIndex] = photo.id
    const nextEmptySlot = assignments.findIndex(value => !value)
    const nextFrame: SessionFrameSet = { ...activeFrame, photos: [...activeFrame.photos, photo], assignments, status: nextEmptySlot === -1 ? 'complete' : 'draft', updatedAt: now }
    const nextSession = { ...activeSession, frames: activeSession.frames.map(item => item.id === nextFrame.id ? nextFrame : item), updatedAt: now }
    persistSession(nextSession)
    setActiveSlot(nextEmptySlot === -1 ? slotIndex : nextEmptySlot)
  }

  const updateActiveFrame = (frame: SessionFrameSet) => {
    if (!activeSessionId) return
    setSessions(current => {
      const session = current.find(item => item.id === activeSessionId)
      if (!session) return current
      const now = new Date().toISOString()
      const complete = frame.assignments.every(Boolean)
      const nextSession = { ...session, frames: session.frames.map(item => item.id === frame.id ? { ...frame, status: complete ? 'complete' as const : 'draft' as const } : item), updatedAt: now }
      void saveStoredSession(nextSession).catch(() => setStorageStatus('error'))
      return [nextSession, ...current.filter(item => item.id !== nextSession.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    })
  }
  const openFrame = (frame: SessionFrameSet) => { setActiveFrameId(frame.id); setStage('frame-editor') }
  const removeFrame = (frame: SessionFrameSet) => {
    if (!activeSession || !window.confirm(settings.language === 'vi' ? 'Xóa frame này khỏi session?' : 'Delete this frame from the session?')) return
    persistSession({ ...activeSession, frames: activeSession.frames.filter(item => item.id !== frame.id), updatedAt: new Date().toISOString() })
    if (activeFrameId === frame.id) { camera.stopCamera(); setActiveFrameId(null); setStage('session-detail') }
  }

  let content: JSX.Element
  if (stage === 'session-list') content = <SessionList language={settings.language} sessions={sessions} templates={[...templates, ...settings.customFrames]} onBack={() => setStage('idle')} onCreate={createSession} onOpen={openSession} onDelete={removeSession} />
  else if (stage === 'template-picker') content = <TemplatePicker language={settings.language} templates={availableTemplates} onChoose={createFrameFromTemplate} onBack={() => setStage('session-detail')} />
  else if (stage === 'slot-capture' && activeSession && activeFrame) {
    content = <SlotCapture key={activeFrame.id} camera={camera} language={settings.language} settings={settings} template={activeTemplate} frame={activeFrame} initialSlot={activeSlot} onAccept={acceptCapture} onChange={updateActiveFrame} onDelete={() => removeFrame(activeFrame)} onCancel={() => { camera.stopCamera(); setStage('session-detail') }} />
  } else if (stage === 'frame-editor' && activeSession && activeFrame) content = <FrameSetEditor language={settings.language} settings={settings} sessionName={activeSession.name} frame={activeFrame} template={activeTemplate} onBack={() => setStage('session-detail')} onChange={updateActiveFrame} onCaptureSlot={slotIndex => void captureSlot(slotIndex)} />
  else if (stage === 'session-detail' && activeSession) content = <SessionFrames language={settings.language} session={activeSession} templates={[...templates, ...settings.customFrames]} onBack={() => setStage('session-list')} onNew={beginNewFrame} onOpen={openFrame} onDelete={removeFrame} />
  else content = <SessionHome language={settings.language} welcomeHeading={settings.welcomeHeading} sessionCount={sessions.length} onCreate={createSession} onView={() => setStage('session-list')} />

  return <main className="app-shell" data-motion={settings.motionLevel} data-stage={stage} ref={appRef}>
    <KioskMotion level={settings.motionLevel} scope={appRef} stage={stage} />
    <div className="ambient-orb orb-one" aria-hidden="true" /><div className="ambient-orb orb-two" aria-hidden="true" />
    <button className="settings-fab" onClick={() => { setSettingsTab('general'); setSettingsOpen(true) }}>{t(settings.language, 'settings')}</button>
    {storageStatus === 'error' && <p className="storage-error" role="alert">{settings.language === 'vi' ? 'Không thể lưu thư viện phiên trên máy này.' : 'The local session library could not be saved.'}</p>}
    <div className="app-stage">{content}</div>
    {settingsOpen && studioFrame === undefined && <SettingsPanel settings={settings} cameraDevices={camera.devices} cameraStatus={camera.status} onCameraChange={selectCamera} onChange={setSettings} onRefreshCameras={() => void camera.refreshDevices()} onOpenStudio={openStudio} initialTab={settingsTab} onClose={() => setSettingsOpen(false)} />}
    {studioFrame !== undefined && <div className="frame-studio-view"><FrameStudio language={settings.language} initialTemplate={studioFrame ?? undefined} onClose={() => setStudioFrame(undefined)} onSave={saveStudioFrame} /></div>}
  </main>
}
