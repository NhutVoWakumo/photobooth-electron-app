export type BoothStage = 'idle' | 'session-list' | 'session-detail' | 'frame-editor' | 'template-picker' | 'frame-preview' | 'capture' | 'countdown' | 'photo-review' | 'selection' | 'review' | 'slot-capture'
import type { Language } from './i18n'
import type { TemplateManifest } from './templates'
import type { PaperSize, PrinterProfile } from '../../shared/printProfile'

export interface SessionPrintSettings {
  paper?: PaperSize | null
  printAutomatically?: boolean
  showPrintButton?: boolean
  autoRotatePrint?: boolean
  maxPrintsPerSession?: number
  maxPrintsPerEvent?: number
  hidePrintButtonAfterLimit?: boolean
  printTwoBySix?: boolean
}

export interface BoothSettings {
  language: Language
  eventName: string
  welcomeHeading: string
  cameraId: string
  cameraName: string
  mirrorCamera: boolean
  mirrorLiveView: boolean
  liveViewEnabled: boolean
  autoTriggerAfterCountdown: boolean
  cameraRotation: 0 | 90 | 180 | 270
  displayCameraOnStartScreen: boolean
  photoEffect: 'none' | 'monochrome' | 'sepia'
  showPrintButton: boolean
  printAutomatically: boolean
  autoRotatePrint: boolean
  maxPrintsPerSession: number
  maxPrintsPerEvent: number
  hidePrintButtonAfterLimit: boolean
  printTwoBySix: boolean
  printerName: string
  printerProfiles: Record<string, PrinterProfile>
  captureMode: 'guided' | 'batch'
  extraCaptureAllowance: number
  retakePolicy: 'limited' | 'unlimited'
  preCaptureDelayMs: number
  postCaptureReviewMs: number
  firstPhotoCountdownSeconds: number
  nextPhotoCountdownSeconds: number
  captureJpegQuality: number
  outputJpegQuality: number
  motionLevel: 'low' | 'medium' | 'high'
  timingDefaultsVersion?: number
  enabledFrameIds: string[]
  customFrames: TemplateManifest[]
}

export interface SessionPhoto {
  id: string
  dataUrl: string
  previewDataUrl?: string
  capturedAt: string
  pinned: boolean
  slotAspectRatio: number
}

export interface PhotoTransform {
  x: number
  y: number
  scale: number
}

export interface SessionFrameSet {
  id: string
  templateId: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'complete'
  printCount?: number
  photos: SessionPhoto[]
  assignments: Array<string | null>
  slotPositions?: number[]
  slotTransforms?: PhotoTransform[]
  qrPlacement?: import('./lib/frameQr').FrameQrPlacement
}

export interface BoothSession {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  frames: SessionFrameSet[]
  eventPrintCount?: number
  printSettings?: SessionPrintSettings
  captureControlsPosition?: 'bottom' | 'left' | 'right'
  qrEnabled?: boolean
  qrSyncedSignature?: string
}

export const defaultSettings: BoothSettings = {
  language: 'en',
  eventName: 'Your Event',
  welcomeHeading: 'Step into\nthe frame.',
  cameraId: '',
  cameraName: 'No camera selected',
  mirrorCamera: true,
  mirrorLiveView: true,
  liveViewEnabled: true,
  autoTriggerAfterCountdown: true,
  cameraRotation: 0,
  displayCameraOnStartScreen: false,
  photoEffect: 'none',
  showPrintButton: true,
  printAutomatically: false,
  autoRotatePrint: true,
  maxPrintsPerSession: 5,
  maxPrintsPerEvent: 100,
  hidePrintButtonAfterLimit: true,
  printTwoBySix: true,
  printerName: 'none',
  printerProfiles: {},
  captureMode: 'guided',
  extraCaptureAllowance: 2,
  retakePolicy: 'limited',
  preCaptureDelayMs: 1000,
  postCaptureReviewMs: 3000,
  firstPhotoCountdownSeconds: 10,
  nextPhotoCountdownSeconds: 5,
  captureJpegQuality: 0.92,
  outputJpegQuality: 0.94,
  motionLevel: 'medium',
  timingDefaultsVersion: 3,
  enabledFrameIds: ['classic-4x1', 'grid-3x2', 'portrait-1x1'],
  customFrames: []
}
