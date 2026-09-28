import { useEffect, useRef, useState, type FormEvent, type JSX, type ReactNode } from 'react'
import type { CameraDevice, CameraStatus } from '../hooks/useCamera'
import { defaultSettings, type BoothSettings } from '../types'
import { t, tr } from '../i18n'
import { BrandLogo } from './BrandLogo'
import { FrameArtwork } from './FrameArtwork'
import { getPhysicalPrintSize, parseFrameImport, templates, type TemplateManifest } from '../templates'
import { importFramePack, makeDemoFramePack } from '../lib/framePack'
import { referenceFrames } from '../referenceFrames'
import { paperSizes, type PaperSize, type PrinterProfile } from '../../../shared/printProfile'

interface SettingsPanelProps {
  cameraDevices: CameraDevice[]
  cameraStatus: CameraStatus
  settings: BoothSettings
  onCameraChange: (cameraId: string) => void
  onChange: (settings: BoothSettings) => void
  onRefreshCameras: () => void
  onOpenStudio: (frame?: TemplateManifest) => void
  initialTab?: SettingsTab
  onClose: () => void
}

type SettingsTab = 'general' | 'frames' | 'capture' | 'output' | 'experience'

export function SettingsPanel({
  cameraDevices, cameraStatus, settings, onCameraChange, onChange, onRefreshCameras, onOpenStudio, initialTab = 'general', onClose
}: SettingsPanelProps): JSX.Element {
  const [draft, setDraft] = useState(settings)
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const update = <Key extends keyof BoothSettings>(key: Key, value: BoothSettings[Key]) => setDraft(current => ({ ...current, [key]: value }))

  useEffect(() => {
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  useEffect(() => { setDraft(settings) }, [settings])
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  const selectCamera = (cameraId: string) => {
    const selected = cameraDevices.find(device => device.id === cameraId)
    update('cameraId', cameraId)
    update('cameraName', selected?.label ?? t(draft.language, 'noCamera'))
  }
  const selectedCameraId = draft.cameraId || cameraDevices[0]?.id || ''
  const selectedCamera = cameraDevices.find(device => device.id === selectedCameraId)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = { ...draft, cameraId: selectedCameraId, cameraName: selectedCamera?.label ?? draft.cameraName }
    onChange(next)
    onCameraChange(next.cameraId)
    onClose()
  }

  const tabs: Array<{ id: SettingsTab; label: string; description: string }> = [
    { id: 'general', label: tr(draft.language, 'Chung', 'General'), description: tr(draft.language, 'Sự kiện và thiết bị', 'Event and devices') },
    { id: 'frames', label: tr(draft.language, 'Khung ảnh', 'Frames'), description: tr(draft.language, 'Layout và theme', 'Layouts and themes') },
    { id: 'capture', label: tr(draft.language, 'Chụp ảnh', 'Capture'), description: tr(draft.language, 'Flow và thời gian', 'Flow and timing') },
    { id: 'output', label: tr(draft.language, 'Đầu ra', 'Output'), description: tr(draft.language, 'Chất lượng file', 'File quality') },
    { id: 'experience', label: tr(draft.language, 'Trải nghiệm', 'Experience'), description: tr(draft.language, 'Ngôn ngữ và hiệu ứng', 'Language and motion') }
  ]

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={event => event.stopPropagation()}>
        <header className="settings-dialog-header">
          <BrandLogo />
          <div><p>{tr(draft.language, 'Điều khiển booth', 'Booth control')}</p><h2 id="settings-title">{t(draft.language, 'settings')}</h2></div>
          <button ref={closeButtonRef} className="dialog-close" type="button" onClick={onClose} aria-label={t(draft.language, 'closeSettings')}>×</button>
        </header>

        <form className="settings-form" onSubmit={submit}>
          <nav className="settings-tabs" role="tablist" aria-label={tr(draft.language, 'Các nhóm cài đặt', 'Settings sections')}>
            {tabs.map(tab => (
              <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
                <strong>{tab.label}</strong><small>{tab.description}</small>
              </button>
            ))}
          </nav>

          <div className="settings-content" role="tabpanel" tabIndex={0}>
            {activeTab === 'general' && <GeneralSettings
              cameraDevices={cameraDevices}
              cameraStatus={cameraStatus}
              draft={draft}
              selectedCameraId={selectedCameraId}
              onRefreshCameras={onRefreshCameras}
              onSelectCamera={selectCamera}
              update={update}
            />}
            {activeTab === 'frames' && <FrameSettings draft={draft} update={update} onOpenStudio={onOpenStudio} />}
            {activeTab === 'capture' && <CaptureSettings draft={draft} update={update} />}
            {activeTab === 'output' && <OutputSettings draft={draft} update={update} />}
            {activeTab === 'experience' && <ExperienceSettings draft={draft} update={update} />}
          </div>

          <footer className="settings-actions">
            <button className="secondary-button" type="button" onClick={onClose}>{t(draft.language, 'cancel')}</button>
            <button className="primary-button" type="submit">{t(draft.language, 'saveSettings')}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

type UpdateSetting = <Key extends keyof BoothSettings>(key: Key, value: BoothSettings[Key]) => void

function SettingsPageHeader({ title, description, aside }: { title: string; description: string; aside?: JSX.Element }): JSX.Element {
  return <div className="settings-page-header">
    <div><h3>{title}</h3><p>{description}</p></div>
    {aside && <div className="settings-page-aside">{aside}</div>}
  </div>
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return <section className="settings-group"><h4>{title}</h4><div className="settings-group-body">{children}</div></section>
}

function GeneralSettings({ cameraDevices, cameraStatus, draft, selectedCameraId, onRefreshCameras, onSelectCamera, update }: {
  cameraDevices: CameraDevice[]; cameraStatus: CameraStatus; draft: BoothSettings; selectedCameraId: string
  onRefreshCameras: () => void; onSelectCamera: (cameraId: string) => void; update: UpdateSetting
}): JSX.Element {
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string; description: string }>>([])
  const [printerError, setPrinterError] = useState('')
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [driveStatus, setDriveStatus] = useState<{ configured: boolean; connected: boolean; pending: number; message: string } | null>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState('')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateResult, setUpdateResult] = useState<{ currentVersion: string; latestVersion: string; updateAvailable: boolean; releaseUrl: string } | null>(null)
  const [updateError, setUpdateError] = useState('')
  const printerProfile = draft.printerProfiles?.[draft.printerName]
  const updatePrinterProfile = (profile: PrinterProfile) => {
    if (draft.printerName === 'none') return
    update('printerProfiles', { ...draft.printerProfiles, [draft.printerName]: profile })
  }
  useEffect(() => { void window.booth?.driveStatus().then(setDriveStatus).catch(() => undefined) }, [])
  const connectDrive = async () => {
    if (!window.booth) return
    setDriveBusy(true); setDriveError('')
    try { await window.booth.driveConnect(); setDriveStatus(await window.booth.driveStatus()); window.dispatchEvent(new Event('luma-drive-changed')) }
    catch (error) { setDriveError(error instanceof Error ? error.message : String(error)) }
    finally { setDriveBusy(false) }
  }
  const importDriveSetup = async () => {
    if (!window.booth) return
    setDriveBusy(true); setDriveError('')
    try {
      if (!await window.booth.driveImportOAuthFile()) return
      setDriveStatus(await window.booth.driveStatus())
      await window.booth.driveConnect()
      setDriveStatus(await window.booth.driveStatus())
      window.dispatchEvent(new Event('luma-drive-changed'))
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : String(error))
      setDriveStatus(await window.booth.driveStatus().catch(() => null))
    } finally { setDriveBusy(false) }
  }
  const refreshPrinters = async () => {
    setLoadingPrinters(true)
    setPrinterError('')
    try {
      if (!window.booth) throw new Error(tr(draft.language, 'Chỉ có trong ứng dụng desktop.', 'Available in the desktop app only.'))
      setPrinters(await window.booth.listPrinters())
    } catch (error) {
      setPrinterError(error instanceof Error ? error.message : String(error))
    } finally { setLoadingPrinters(false) }
  }
  const checkUpdates = async () => {
    setUpdateBusy(true)
    setUpdateError('')
    try {
      if (!window.booth) throw new Error(tr(draft.language, 'Chỉ có trong ứng dụng desktop.', 'Available in the desktop app only.'))
      setUpdateResult(await window.booth.checkForUpdates())
    } catch (error) {
      setUpdateResult(null)
      setUpdateError(error instanceof Error ? error.message : String(error))
    } finally { setUpdateBusy(false) }
  }
  useEffect(() => { void refreshPrinters() }, [])
  return <div className="settings-section">
    <SettingsPageHeader title={tr(draft.language, 'Sự kiện & thiết bị', 'Event & devices')} description={tr(draft.language, 'Thông tin hiển thị và phần cứng dùng trong booth.', 'Identity and hardware used by this booth.')} />
    <SettingsGroup title={tr(draft.language, 'Thiết bị', 'Hardware')}>
      <div className="settings-field"><div className="field-heading"><span>{t(draft.language, 'camera')}</span><button className="text-button" type="button" onClick={onRefreshCameras}>{t(draft.language, 'refresh')}</button></div>
        <select aria-label={t(draft.language, 'cameraAria')} value={selectedCameraId} onChange={event => onSelectCamera(event.target.value)} disabled={cameraDevices.length === 0}>
          {cameraDevices.length === 0 ? <option value="">{t(draft.language, 'noCamera')}</option> : cameraDevices.map(camera => <option key={camera.id} value={camera.id}>{camera.label}</option>)}
        </select><small className="field-help">{cameraStatus === 'denied' ? t(draft.language, 'cameraPermissionBlocked') : t(draft.language, 'cameraPermissionHelp')}</small></div>
      <label className="settings-check"><input type="checkbox" checked={draft.mirrorLiveView} onChange={event => update('mirrorLiveView', event.target.checked)} /><span>{tr(draft.language, 'Lật gương màn xem trước', 'Mirror live view')}<small>{tr(draft.language, 'Chỉ đổi hình khách nhìn khi chụp; không đổi ảnh được lưu.', 'Changes only what guests see before capture, not the saved photo.')}</small></span></label>
      <label className="settings-check"><input type="checkbox" checked={draft.mirrorCamera} onChange={event => update('mirrorCamera', event.target.checked)} /><span>{tr(draft.language, 'Lật gương ảnh được lưu', 'Mirror captured photos')}<small>{tr(draft.language, 'Bật cho ảnh kiểu selfie; tắt để chữ trong ảnh giữ chiều thực tế.', 'On for selfie-style photos; off to preserve the real-world direction of text.')}</small></span></label>
      <label className="settings-check"><input type="checkbox" checked={draft.liveViewEnabled} onChange={event => update('liveViewEnabled', event.target.checked)} /><span>{tr(draft.language, 'Hiện hình camera trực tiếp', 'Enable live view')}<small>{tr(draft.language, 'Tắt hình xem trước để giảm tải hiển thị; camera vẫn hoạt động khi chụp.', 'Hide the preview to reduce rendering load; the camera still captures photos.')}</small></span></label>
      <label className="settings-check"><input type="checkbox" checked={draft.displayCameraOnStartScreen} onChange={event => update('displayCameraOnStartScreen', event.target.checked)} /><span>{tr(draft.language, 'Hiện camera ở màn hình bắt đầu', 'Display on start screen')}<small>{tr(draft.language, 'Khi bật, app mở camera tại trang chính và tắt khi rời trang đó.', 'When enabled, the camera opens on the home screen and closes when you leave it.')}</small></span></label>
      <SegmentedSetting label={tr(draft.language, 'Xoay camera', 'Camera rotation')} value={String(draft.cameraRotation)} options={[0, 90, 180, 270].map(degrees => ({ value: String(degrees), label: `${degrees}°` }))} onChange={value => update('cameraRotation', Number(value) as BoothSettings['cameraRotation'])} />
      <label className="settings-check"><input type="checkbox" checked={draft.autoTriggerAfterCountdown} onChange={event => update('autoTriggerAfterCountdown', event.target.checked)} /><span>{tr(draft.language, 'Tự chụp sau đếm ngược', 'Trigger automatically')}<small>{tr(draft.language, 'Tắt để hiện nút xác nhận chụp sau khi đếm ngược kết thúc.', 'Turn off to require a tap after the countdown finishes.')}</small></span></label>
      <p className="field-help camera-capability-note">{tr(draft.language, 'Điều khiển màn trập, ISO và Canon Auto Exposure chưa được hỗ trợ với webcam/camera chuẩn hiện tại. Cần kết nối tether riêng theo model máy ảnh.', 'Shutter, ISO, and Canon Auto Exposure are not available through the current standard webcam connection. Camera tethering must be added per model.')}</p>
      <div className="settings-field"><div className="field-heading"><span>{t(draft.language, 'printer')}</span><button className="text-button" type="button" onClick={() => void refreshPrinters()} disabled={loadingPrinters}>{loadingPrinters ? tr(draft.language, 'Đang tìm…', 'Searching…') : t(draft.language, 'refresh')}</button></div>
        <select aria-label={t(draft.language, 'printer')} value={draft.printerName} onChange={event => update('printerName', event.target.value)}><option value="none">{t(draft.language, 'noPrinter')}</option>{draft.printerName !== 'none' && !printers.some(printer => printer.name === draft.printerName) && <option value={draft.printerName}>{draft.printerName} — {tr(draft.language, 'không kết nối', 'unavailable')}</option>}{printers.map(printer => <option key={printer.name} value={printer.name}>{printer.displayName || printer.name}</option>)}</select>
        <small className="field-help">{printerError || (draft.printerName !== 'none' && !printers.some(printer => printer.name === draft.printerName) ? tr(draft.language, 'Máy in đã chọn không còn kết nối. Hãy chọn lại.', 'The selected printer is unavailable. Choose another.') : tr(draft.language, 'Chọn đúng khổ giấy đang đặt trong driver. Mỗi máy in nhớ cấu hình riêng.', 'Match the paper loaded in the printer driver. Each printer keeps its own setup.'))}</small></div>
      <>{draft.printerName !== 'none' && <div className="settings-field print-profile-field">
        <label htmlFor="printer-paper">{tr(draft.language, 'Khổ giấy của máy in', 'Printer paper size')}</label>
        <select id="printer-paper" value={printerProfile?.paper ?? ''} onChange={event => updatePrinterProfile({ paper: event.target.value as PaperSize, marginMm: 3, fit: 'contain' })}>
          <option value="">{tr(draft.language, 'Chọn khổ giấy trước khi in', 'Choose paper before printing')}</option>
          {Object.entries(paperSizes).map(([value, paper]) => <option key={value} value={value}>{paper.label}</option>)}
        </select>
        <small className="field-help">{tr(draft.language, 'Canon giấy văn phòng: chọn A5/A4 giống driver. DNP: chọn đúng cỡ media đang lắp; 4×6 là điểm bắt đầu cho RX1HS/QW410.', 'Office printer: match A5/A4 in its driver. DNP: match the loaded media; 4×6 is a starting point for RX1HS/QW410.')}</small>
        {printerProfile && <small className="field-help">{tr(draft.language, 'Cỡ giấy ở đây là mặc định. Có thể chọn cỡ khác riêng trong từng session.', 'This is the default paper size. Each session can override it.')}</small>}
      </div>}</>
    </SettingsGroup>
    <SettingsGroup title={tr(draft.language, 'Chia sẻ ảnh', 'Photo sharing')}>
      <div className="settings-field drive-setup-field"><div className="field-heading"><span>Google Drive</span></div>
        <p className="field-help">{driveStatus?.connected ? tr(draft.language, 'Đã kết nối trên máy này. QR mặc định bật cho các phiên.', 'Connected on this computer. QR is on by default for sessions.') : tr(draft.language, 'Chưa kết nối. QR tắt; ảnh vẫn lưu trên máy.', 'Not connected. QR is off; photos stay on this computer.')}</p>
        <div className="drive-setup-actions">
          <button className="secondary-button" type="button" disabled={driveBusy || driveStatus === null || !driveStatus.configured} onClick={() => void connectDrive()}>{driveBusy ? tr(draft.language, 'Đang kết nối…', 'Connecting…') : driveStatus?.connected ? tr(draft.language, 'Kết nối lại Google Drive', 'Reconnect Google Drive') : tr(draft.language, 'Kết nối Google Drive', 'Connect Google Drive')}</button>
        </div>
        {!driveStatus?.configured && <small className="field-help">{tr(draft.language, 'Bản app này chưa được cấu hình Google Drive. Hãy báo người phát hành.', 'Google Drive is not configured in this build. Ask the app owner.')}</small>}
        {driveStatus?.configured && <small className="field-help">{tr(draft.language, 'Đăng nhập bằng Google của bạn; ảnh sẽ lưu vào Drive của bạn. Không cần file thiết lập.', 'Sign in with your own Google account. Photos go to your Drive; no setup file needed.')}</small>}
        <details className="drive-advanced"><summary>{tr(draft.language, 'Thiết lập nâng cao', 'Advanced setup')}</summary><button className="secondary-button" type="button" disabled={driveBusy} onClick={() => void importDriveSetup()}>{tr(draft.language, 'Nhập file OAuth Desktop riêng', 'Import a different Desktop OAuth file')}</button></details>
        {driveError && <small className="field-help" role="alert">{driveError}</small>}
      </div>
    </SettingsGroup>
    <SettingsGroup title={tr(draft.language, 'Cập nhật ứng dụng', 'App updates')}>
      <div className="settings-field">
        <p className="field-help">{tr(draft.language, 'Kiểm tra phiên bản mới từ GitHub. Cập nhật sẽ mở trang tải bộ cài; dữ liệu session và cài đặt được lưu riêng với ứng dụng.', 'Check GitHub for a newer version. Updates open the installer download page; sessions and settings are stored separately from the app.')}</p>
        <div className="drive-setup-actions">
          <button className="secondary-button" type="button" disabled={updateBusy} onClick={() => void checkUpdates()}>{updateBusy ? tr(draft.language, 'Đang kiểm tra…', 'Checking…') : tr(draft.language, 'Kiểm tra cập nhật', 'Check for updates')}</button>
          {updateResult?.updateAvailable && <button className="primary-button" type="button" onClick={() => void window.booth?.openUpdatePage(updateResult.releaseUrl)}>{tr(draft.language, `Tải bản ${updateResult.latestVersion}`, `Download ${updateResult.latestVersion}`)}</button>}
        </div>
        {updateError && <small className="field-help" role="alert">{tr(draft.language, 'Không kiểm tra được. Hãy kiểm tra kết nối mạng rồi thử lại.', 'Could not check for updates. Check your internet connection and try again.')} ({updateError})</small>}
        {updateResult && <small className="field-help" role="status">{updateResult.updateAvailable
          ? tr(draft.language, `Đang dùng ${updateResult.currentVersion}. Có bản mới ${updateResult.latestVersion}.`, `You have ${updateResult.currentVersion}. Version ${updateResult.latestVersion} is available.`)
          : tr(draft.language, `Đang dùng bản mới nhất (${updateResult.currentVersion}).`, `You’re up to date (${updateResult.currentVersion}).`)}</small>}
      </div>
    </SettingsGroup>
  </div>
}

function FrameSettings({ draft, update, onOpenStudio }: { draft: BoothSettings; update: UpdateSetting; onOpenStudio: (frame?: TemplateManifest) => void }): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const packInputRef = useRef<HTMLInputElement>(null)
  const [importMessage, setImportMessage] = useState('')
  const allFrames = [...templates, ...referenceFrames, ...draft.customFrames.filter(frame => !referenceFrames.some(reference => reference.id === frame.id))]
  // An operator returns here to verify the frame they have just made. Surface
  // custom work first (newest first) instead of burying it after every preset.
  const newestCustomFirst = (left: TemplateManifest, right: TemplateManifest) => {
    if (Boolean(left.builtIn) !== Boolean(right.builtIn)) return left.builtIn ? 1 : -1
    if (!left.builtIn && !right.builtIn) return (right.createdAt ?? '').localeCompare(left.createdAt ?? '')
    return 0
  }
  const activeFrames = allFrames.filter(frame => referenceFrames.some(reference => reference.id === frame.id) || draft.enabledFrameIds.includes(frame.id)).sort(newestCustomFirst)
  const archivedFrames = allFrames.filter(frame => !referenceFrames.some(reference => reference.id === frame.id) && !draft.enabledFrameIds.includes(frame.id))
  const enabledCount = activeFrames.length

  const addImportedFrame = (frame: TemplateManifest) => {
    const exists = draft.customFrames.some(item => item.id === frame.id)
    update('customFrames', exists ? draft.customFrames.map(item => item.id === frame.id ? frame : item) : [...draft.customFrames, frame])
    if (!draft.enabledFrameIds.includes(frame.id)) update('enabledFrameIds', [...draft.enabledFrameIds, frame.id])
    setImportMessage(tr(draft.language, 'Đã nhập Frame Pack. Bấm Lưu cài đặt để lưu local.', 'Frame Pack imported. Choose Save settings to persist it locally.'))
  }
  const importPack = async (file?: File) => {
    if (!file) return
    try { addImportedFrame(await importFramePack(file)) }
    catch (error) { setImportMessage(error instanceof Error ? error.message : tr(draft.language, 'Không thể đọc Frame Pack.', 'Could not read Frame Pack.')) }
  }

  const toggleFrame = (frame: TemplateManifest) => {
    const enabled = draft.enabledFrameIds.includes(frame.id)
    if (enabled && enabledCount === 1) return
    update('enabledFrameIds', enabled ? draft.enabledFrameIds.filter(id => id !== frame.id) : [...draft.enabledFrameIds, frame.id])
  }

  const importFrame = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const frame = parseFrameImport(String(reader.result))
        if (allFrames.some(item => item.id === frame.id)) throw new Error('A frame with this ID already exists.')
        update('customFrames', [...draft.customFrames, frame])
        update('enabledFrameIds', [...draft.enabledFrameIds, frame.id])
        setImportMessage(tr(draft.language, 'Đã import khung và bật hiển thị cho khách.', 'Frame imported and enabled for guests.'))
      } catch (error) {
        setImportMessage(error instanceof Error ? error.message : tr(draft.language, 'Không thể đọc file khung.', 'Could not read the frame file.'))
      }
    }
    reader.readAsText(file)
  }

  const removeCustomFrame = (frame: TemplateManifest) => {
    update('customFrames', draft.customFrames.filter(item => item.id !== frame.id))
    update('enabledFrameIds', draft.enabledFrameIds.filter(id => id !== frame.id))
  }

  return <div className="settings-section frame-settings-section">
    <SettingsPageHeader title={tr(draft.language, 'Khung cho khách chọn', 'Guest frame selection')} description={tr(draft.language, 'Chọn những layout xuất hiện ngoài booth. Mỗi khung vẫn giữ đúng tỷ lệ in khi hiển thị.', 'Choose which layouts guests can see. Every preview keeps its final print ratio.')} aside={<strong className="settings-stat">{enabledCount}<span>{tr(draft.language, 'đang bật', 'active')}</span></strong>} />

    <section className="frame-active-shelf" aria-labelledby="active-frames-title">
      <div className="frame-shelf-title"><h4 id="active-frames-title">{tr(draft.language, 'Đang hiện ngoài booth', 'Live at the booth')}</h4><p>{tr(draft.language, 'Tắt một khung để cất vào thư viện.', 'Turn a frame off to move it back to the library.')}</p></div>
      <div className="frame-active-grid" role="list">
        {activeFrames.map(frame => <article className="frame-active-card" key={frame.id} role="listitem">
          <div className="frame-active-preview"><FrameArtwork template={frame} language={draft.language} /></div>
          <div className="frame-active-copy"><strong>{frame.name}</strong><small>{frame.requiredSlots} {tr(draft.language, 'ảnh', frame.requiredSlots === 1 ? 'photo' : 'photos')}<br />{getPhysicalPrintSize(frame)}<br />{frame.output.width} × {frame.output.height}px at {frame.output.ppi} PPI</small></div>
          <div className="frame-active-actions"><button className="frame-edit-button" type="button" onClick={() => onOpenStudio(frame)}>{frame.builtIn ? tr(draft.language, 'Remix', 'Remix') : tr(draft.language, 'Chỉnh sửa', 'Edit')}</button><button className="frame-on-button" type="button" aria-pressed="true" onClick={() => toggleFrame(frame)} disabled={enabledCount === 1}>{tr(draft.language, 'Đang hiện', 'Visible')}</button>{!frame.builtIn && <button className="frame-remove" type="button" onClick={() => removeCustomFrame(frame)}>{tr(draft.language, 'Gỡ', 'Remove')}</button>}</div>
        </article>)}
      </div>
    </section>

    <section className="frame-archive" aria-labelledby="frame-archive-title">
      <div className="frame-archive-title"><h4 id="frame-archive-title">{tr(draft.language, 'Thư viện format', 'More formats')}</h4><p>{archivedFrames.length} {tr(draft.language, 'layout sẵn sàng để thêm', 'layouts ready to add')}</p></div>
      <div className="frame-archive-grid" role="list">
        {archivedFrames.map(frame => <article className="frame-archive-card" key={frame.id} role="listitem">
          <div className="frame-archive-preview"><FrameArtwork template={frame} language={draft.language} /></div>
          <div className="frame-archive-copy"><strong>{frame.name}</strong><small>{frame.requiredSlots} {tr(draft.language, 'ảnh', frame.requiredSlots === 1 ? 'photo' : 'photos')}<br />{getPhysicalPrintSize(frame)}<br />{frame.output.width} × {frame.output.height}px at {frame.output.ppi} PPI</small></div>
          <button className="frame-edit-button" type="button" onClick={() => onOpenStudio(frame)}>{frame.builtIn ? tr(draft.language, 'Remix', 'Remix') : tr(draft.language, 'Chỉnh sửa', 'Edit')}</button>
          <button className="frame-add-button" type="button" onClick={() => toggleFrame(frame)}>{tr(draft.language, 'Thêm vào booth', 'Add to booth')}</button>
          {!frame.builtIn && <button className="frame-remove" type="button" onClick={() => removeCustomFrame(frame)}>{tr(draft.language, 'Gỡ', 'Remove')}</button>}
        </article>)}
      </div>
    </section>

    <div className="frame-builder frame-studio-launch"><div><p className="frame-builder-kicker">LUMA FRAME STUDIO</p><h4>{tr(draft.language, 'Thiết kế frame tự do', 'Design a custom frame')}</h4><p>{tr(draft.language, 'Tạo mask ảnh heart, blob, star hoặc scallop; thêm sticker vector, pattern, chữ có outline, shape, nét vẽ, logo và overlay. Có Undo/Redo, layer controls, lưu local và export để sửa lại.', 'Create heart, blob, star, or scallop photo masks; add vector stickers, patterns, outlined type, shapes, drawing, logos, and overlays. Undo/Redo, layer controls, local storage, and editable export are included.')}</p></div><button className="primary-button" type="button" onClick={() => onOpenStudio()}>{tr(draft.language, 'Mở Frame Studio', 'Open Frame Studio')}</button></div>

    <div className="frame-import"><div><h4>{tr(draft.language, 'Nhập Frame Pack từ designer', 'Import a designer Frame Pack')}</h4><p>{tr(draft.language, 'Frame Pack .zip gồm manifest, nền, overlay và mask. Nó là cách bàn giao chuẩn từ Figma, Canva, Photoshop hoặc Penci sau khi export asset.', 'A Frame Pack .zip contains a manifest, background, overlay, and masks. It is the standard handoff from Figma, Canva, Photoshop, or Penci after assets are exported.')}</p></div><input ref={packInputRef} className="visually-hidden" type="file" accept="application/zip,.zip,.luma-frame.zip" onChange={event => void importPack(event.target.files?.[0])} /><div className="frame-import-actions"><button className="primary-button" type="button" onClick={() => packInputRef.current?.click()}>{tr(draft.language, 'Chọn Frame Pack', 'Choose Frame Pack')}</button><button className="secondary-button" type="button" onClick={() => void importPack(makeDemoFramePack())}>{tr(draft.language, 'Thử mẫu demo', 'Try demo pack')}</button></div></div>
    <div className="frame-import compact"><div><h4>{tr(draft.language, 'Nhập LUMA JSON cũ', 'Import legacy LUMA JSON')}</h4><p>{tr(draft.language, 'Dành cho frame đã export từ phiên bản Studio trước.', 'For frames exported by an earlier Studio version.')}</p></div><input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json,.luma-frame.json" onChange={event => importFrame(event.target.files?.[0])} /><button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>{tr(draft.language, 'Chọn JSON', 'Choose JSON')}</button></div>
    {importMessage && <p className="frame-import-status" role="status">{importMessage}</p>}
  </div>
}

function CaptureSettings({ draft, update }: { draft: BoothSettings; update: UpdateSetting }): JSX.Element {
  // Settings may be open during a hot update with the previous in-memory schema.
  const firstCountdown = draft.firstPhotoCountdownSeconds ?? defaultSettings.firstPhotoCountdownSeconds
  const nextCountdown = draft.nextPhotoCountdownSeconds ?? defaultSettings.nextPhotoCountdownSeconds
  const reviewSeconds = (draft.postCaptureReviewMs ?? defaultSettings.postCaptureReviewMs) / 1000
  return <div className="settings-section">
    <SettingsPageHeader title={tr(draft.language, 'Flow chụp ảnh', 'Capture flow')} description={tr(draft.language, 'Điều chỉnh cách khách chụp, xem và chụp lại.', 'Control how guests capture, review, and retake photos.')} />
    <SettingsGroup title={tr(draft.language, 'Nhịp chụp tự động', 'Automatic timing')}>
      <TouchRange label={tr(draft.language, 'Đếm ngược ảnh đầu tiên', 'First photo countdown')} value={firstCountdown} min={1} max={30} step={1} valueLabel={`${firstCountdown}s`} onChange={value => update('firstPhotoCountdownSeconds', value)} />
      <TouchRange label={tr(draft.language, 'Đếm ngược các ảnh tiếp theo', 'Next photo countdown')} value={nextCountdown} min={1} max={30} step={1} valueLabel={`${nextCountdown}s`} onChange={value => update('nextPhotoCountdownSeconds', value)} />
      <TouchRange label={tr(draft.language, 'Xem lại sau mỗi ảnh', 'Photo preview duration')} value={reviewSeconds} min={1} max={30} step={1} valueLabel={`${reviewSeconds}s`} onChange={value => update('postCaptureReviewMs', value * 1000)} />
      <p className="touch-setting-note">{tr(draft.language, 'Sau khi bấm Capture, booth sẽ tự đếm ngược, chụp, cho xem ảnh rồi chuyển sang slot kế tiếp.', 'After Capture, the booth counts down, takes the photo, shows it, and automatically continues to the next slot.')}</p>
    </SettingsGroup>
    <SettingsGroup title={tr(draft.language, 'Diện mạo ảnh chụp', 'Photo look')}>
      <SegmentedSetting label={tr(draft.language, 'Hiệu ứng ảnh', 'Photo effect')} value={draft.photoEffect} options={[{ value: 'none', label: tr(draft.language, 'Gốc', 'Original') }, { value: 'monochrome', label: tr(draft.language, 'Đen trắng', 'B&W') }, { value: 'sepia', label: 'Sepia' }]} onChange={value => update('photoEffect', value as BoothSettings['photoEffect'])} />
      <p className="touch-setting-note">{tr(draft.language, 'Hiệu ứng hiện trên camera và được ghi vào từng ảnh chụp; ảnh cũ không bị thay đổi.', 'The effect appears in live view and is saved into each new photo. Existing photos stay unchanged.')}</p>
    </SettingsGroup>
  </div>
}

function OutputSettings({ draft, update }: { draft: BoothSettings; update: UpdateSetting }): JSX.Element {
  return <div className="settings-section">
    <SettingsPageHeader title={tr(draft.language, 'Chất lượng đầu ra', 'Output quality')} description={tr(draft.language, 'Cân bằng độ nét, tốc độ xử lý và dung lượng lưu trữ.', 'Balance detail, rendering speed, and local storage.')} />
    <SettingsGroup title={tr(draft.language, 'Tệp ảnh', 'Image files')}>
      <TouchRange label={t(draft.language, 'originalQuality')} value={Math.round(draft.captureJpegQuality * 100)} min={80} max={100} step={1} valueLabel={`${Math.round(draft.captureJpegQuality * 100)}%`} onChange={value => update('captureJpegQuality', value / 100)} />
      <TouchRange label={t(draft.language, 'finalQuality')} value={Math.round(draft.outputJpegQuality * 100)} min={80} max={100} step={1} valueLabel={`${Math.round(draft.outputJpegQuality * 100)}%`} onChange={value => update('outputJpegQuality', value / 100)} />
    </SettingsGroup>
  </div>
}

function ExperienceSettings({ draft, update }: { draft: BoothSettings; update: UpdateSetting }): JSX.Element {
  return <div className="settings-section">
    <SettingsPageHeader title={tr(draft.language, 'Trải nghiệm khách', 'Guest experience')} description={tr(draft.language, 'Ngôn ngữ và mức hiệu ứng phù hợp với cấu hình máy.', 'Language and motion tuned to the booth hardware.')} />
    <SettingsGroup title={tr(draft.language, 'Hiển thị', 'Presentation')}>
      <SegmentedSetting label={t(draft.language, 'language')} value={draft.language} options={[{ value: 'en', label: t(draft.language, 'english') }, { value: 'vi', label: t(draft.language, 'vietnamese') }]} onChange={value => update('language', value as BoothSettings['language'])} />
      <SegmentedSetting label={t(draft.language, 'motionLevel')} value={draft.motionLevel} options={[{ value: 'low', label: t(draft.language, 'motionLow') }, { value: 'medium', label: t(draft.language, 'motionMedium') }, { value: 'high', label: t(draft.language, 'motionHigh') }]} onChange={value => update('motionLevel', value as BoothSettings['motionLevel'])} />
    </SettingsGroup>
  </div>
}

function TouchRange({ label, value, min, max, step, valueLabel, disabled = false, onChange }: { label: string; value: number; min: number; max: number; step: number; valueLabel: string; disabled?: boolean; onChange: (value: number) => void }): JSX.Element {
  return <label className={`touch-range ${disabled ? 'disabled' : ''}`}><span><strong>{label}</strong><output>{valueLabel}</output></span><input type="range" value={value} min={min} max={max} step={step} disabled={disabled} onChange={event => onChange(Number(event.target.value))} /></label>
}

function SegmentedSetting({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }): JSX.Element {
  return <div className="segmented-setting"><span>{label}</span><div>{options.map(option => <button type="button" key={option.value} className={value === option.value ? 'active' : ''} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></div>
}
