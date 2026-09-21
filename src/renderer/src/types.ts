export type BoothStage = 'idle' | 'session-list' | 'session-detail' | 'frame-editor' | 'template-picker' | 'frame-preview' | 'capture' | 'countdown' | 'photo-review' | 'selection' | 'review' | 'slot-capture'
import type { Language } from './i18n'
import type { TemplateManifest } from './templates'

export interface BoothSettings {
  language: Language
  eventName: string
  welcomeHeading: string
  cameraId: string
  cameraName: string
  mirrorCamera: boolean
  printerName: string
  captureMode: 'guided' | 'batch'
  extraCaptureAllowance: number
  retakePolicy: 'limited' | 'unlimited'
  preCaptureDelayMs: number
  postCaptureReviewMs: number
  countdownSeconds: number
  captureJpegQuality: number
  outputJpegQuality: number
  motionLevel: 'low' | 'medium' | 'high'
  enabledFrameIds: string[]
  customFrames: TemplateManifest[]
}

export interface SessionPhoto {
  id: string
  dataUrl: string
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
  photos: SessionPhoto[]
  assignments: Array<string | null>
  slotPositions?: number[]
  slotTransforms?: PhotoTransform[]
}

export interface BoothSession {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  frames: SessionFrameSet[]
}

export const defaultSettings: BoothSettings = {
  language: 'en',
  eventName: 'Your Event',
  welcomeHeading: 'Step into\nthe frame.',
  cameraId: '',
  cameraName: 'No camera selected',
  mirrorCamera: true,
  printerName: 'none',
  captureMode: 'guided',
  extraCaptureAllowance: 2,
  retakePolicy: 'limited',
  preCaptureDelayMs: 1000,
  postCaptureReviewMs: 3000,
  countdownSeconds: 3,
  captureJpegQuality: 0.92,
  outputJpegQuality: 0.94,
  motionLevel: 'medium',
  enabledFrameIds: ['classic-4x1', 'grid-3x2', 'portrait-1x1'],
  customFrames: []
}
