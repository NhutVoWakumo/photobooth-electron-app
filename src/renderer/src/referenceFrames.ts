import gardenBackground from './assets/penci-garden-bg.jpg'
import skyBackground from './assets/penci-sky-bg.jpg'
import socialHeader from './assets/penci-social-header.svg'
import socialActions from './assets/penci-social-actions.svg'
import socialPlayer from './assets/penci-social-player.svg'
import canvaTogetherBookmark from './assets/canva-together-bookmark.png'
import type { TemplateManifest } from './templates'

// These are the two reference compositions rebuilt as editable manifests. The
// artwork is only decorative background; every guest photo remains a real slot.
export const referenceFrames: TemplateManifest[] = [
  {
    id: 'canva-together-bookmark', name: 'Canva Together — imported', description: 'Canva PNG artwork with two editable oval photo slots.', rows: 1, columns: 2, requiredSlots: 2, printLabel: '2 × 6 in strip', output: { width: 600, height: 1800, ppi: 300 }, builtIn: false,
    background: { kind: 'solid', color: '#7c0808', secondaryColor: '#f5efe2', scale: 8, angle: 0 },
    theme: { id: 'canva-together', label: 'Canva Together', paper: '#7c0808', ink: '#fffaf0', accent: '#eaa0a7', slotLight: '#fffaf0', slotDark: '#f2dfe0' },
    slots: [
      // The exported Canva lace is wider than its usable ivory opening. These
      // bounds are calibrated to keep the guest photo inside that opening.
      { id: 'canva-together-1', x: .18, y: .10, width: .64, height: .265, shape: 'ellipse', fit: 'cover', zIndex: 10 },
      { id: 'canva-together-2', x: .18, y: .455, width: .64, height: .265, shape: 'ellipse', fit: 'cover', zIndex: 10 }
    ],
    layers: [{ id: 'canva-together-artwork', type: 'image', x: 0, y: 0, width: 1, height: 1, src: canvaTogetherBookmark, opacity: 1, fit: 'cover', focusX: 50, focusY: 50, zIndex: 0, locked: true }],
    createdAt: '2026-09-22T10:35:00.000Z'
  },
  {
    id: 'penci-garden-rebuild', name: 'Penci Garden — rebuilt', description: 'Four rounded family photos over the Penci garden artwork.', rows: 4, columns: 1, requiredSlots: 4, printLabel: '2 × 6 in strip', output: { width: 600, height: 1800, ppi: 300 }, builtIn: false,
    background: { kind: 'solid', color: '#f7edf0', secondaryColor: '#d9f0ff', scale: 8, angle: 0 },
    theme: { id: 'penci-garden', label: 'Penci garden', paper: '#f7edf0', ink: '#365348', accent: '#f5a5b9', slotLight: '#dce9dc', slotDark: '#8fb49e' },
    slots: [
      { id: 'garden-1', x: .075, y: .03, width: .85, height: .19, shape: 'rounded', radius: .12, fit: 'cover', zIndex: 10 },
      { id: 'garden-2', x: .075, y: .275, width: .85, height: .19, shape: 'rounded', radius: .12, fit: 'cover', zIndex: 10 },
      { id: 'garden-3', x: .075, y: .52, width: .85, height: .19, shape: 'rounded', radius: .12, fit: 'cover', zIndex: 10 },
      { id: 'garden-4', x: .075, y: .765, width: .85, height: .19, shape: 'rounded', radius: .12, fit: 'cover', zIndex: 10 }
    ],
    layers: [{ id: 'garden-artwork', type: 'image', x: 0, y: 0, width: 1, height: 1, src: gardenBackground, opacity: 1, fit: 'cover', focusX: 50, focusY: 50, zIndex: 0, locked: true }],
    createdAt: '2026-09-22T00:00:00.000Z'
  },
  {
    id: 'penci-social-rebuild', name: 'Penci Social — rebuilt', description: 'Two social-feed photo cards with love typography and player controls.', rows: 1, columns: 2, requiredSlots: 2, printLabel: '2 × 6 in strip', output: { width: 600, height: 1800, ppi: 300 }, builtIn: false,
    background: { kind: 'solid', color: '#ffffff', secondaryColor: '#ffffff', scale: 8, angle: 0 },
    theme: { id: 'penci-social', label: 'Penci social', paper: '#ffffff', ink: '#494949', accent: '#d4164a', slotLight: '#f7f7f7', slotDark: '#dedede' },
    slots: [
      { id: 'social-1', x: .14, y: .11, width: .72, height: .245, shape: 'rectangle', fit: 'cover', zIndex: 10 },
      { id: 'social-2', x: .14, y: .60, width: .72, height: .225, shape: 'rectangle', fit: 'cover', zIndex: 10 }
    ],
    layers: [
      { id: 'social-header-1', type: 'image', x: .08, y: .035, width: .84, height: .07, src: socialHeader, opacity: 1, fit: 'contain', zIndex: 30 },
      { id: 'social-actions-1', type: 'image', x: .08, y: .375, width: .84, height: .07, src: socialActions, opacity: 1, fit: 'contain', zIndex: 30 },
      { id: 'social-love-1', type: 'text', x: .2, y: .45, width: .6, height: .042, text: 'love', color: '#d4164a', fontSize: 7, fontWeight: 800, align: 'center', fontFamily: 'script', zIndex: 30 },
      { id: 'social-love-2', type: 'text', x: .2, y: .49, width: .6, height: .032, text: 'love', color: '#555555', fontSize: 5, fontWeight: 800, align: 'center', fontFamily: 'script', zIndex: 30 },
      { id: 'social-header-2', type: 'image', x: .08, y: .53, width: .84, height: .07, src: socialHeader, opacity: 1, fit: 'contain', zIndex: 30 },
      { id: 'social-actions-2', type: 'image', x: .08, y: .835, width: .84, height: .07, src: socialActions, opacity: 1, fit: 'contain', zIndex: 30 },
      { id: 'social-caption', type: 'text', x: .13, y: .91, width: .74, height: .03, text: 'TÌNH YÊU HỌC TRÒ', color: '#4b4b4b', fontSize: 4.6, fontWeight: 850, align: 'center', fontFamily: 'display', letterSpacing: .02, zIndex: 30 },
      { id: 'social-progress', type: 'shape', x: .19, y: .95, width: .62, height: .012, shape: 'rounded', fill: '#dedede', stroke: 'transparent', strokeWidth: 0, zIndex: 30 },
      { id: 'social-progress-fill', type: 'shape', x: .19, y: .95, width: .34, height: .012, shape: 'rounded', fill: '#d4164a', stroke: 'transparent', strokeWidth: 0, zIndex: 31 },
      { id: 'social-controls', type: 'image', x: .15, y: .963, width: .7, height: .035, src: socialPlayer, opacity: 1, fit: 'contain', zIndex: 30 }
    ],
    createdAt: '2026-09-22T00:01:00.000Z'
  }
]
