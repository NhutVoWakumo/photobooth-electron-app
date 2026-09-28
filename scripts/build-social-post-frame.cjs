// Rebuild the editable social-post Frame Pack. Every icon is its own Studio layer.
// The interaction glyphs use Lucide paths (ISC); see assets/templates/LUCIDE-LICENSE.txt.
const fs = require('node:fs')
const path = require('node:path')
const { strToU8, zipSync } = require('fflate')

const root = path.resolve(__dirname, '..')
const output = process.argv[2] || path.join(root, 'assets/templates/luma-social-post-v2.luma-frame.zip')
const svg = (body, viewBox = '0 0 24 24') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`
const lineIcon = paths => svg(`<g fill="none" stroke="#f8fafb" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`)
const assets = {
  'assets/background.svg': svg('<rect width="1200" height="1800" fill="#0d1115"/>', '0 0 1200 1800'),
  'assets/avatar.svg': svg('<circle cx="50" cy="50" r="49" fill="#f8faf4"/><circle cx="50" cy="50" r="39" fill="#193525"/><path d="M32 29h-4a5 5 0 0 0-5 5v9m45-14h4a5 5 0 0 1 5 5v9M23 58v8a5 5 0 0 0 5 5h8m41-13v8a5 5 0 0 1-5 5h-8" fill="none" stroke="#e5f3e4" stroke-width="4" stroke-linecap="round"/><path d="M50 29c3 13 8 18 21 21-13 3-18 8-21 21-3-13-8-18-21-21 13-3 18-8 21-21Z" fill="none" stroke="#e5f3e4" stroke-width="4"/><circle cx="50" cy="50" r="4" fill="#b7e1b1"/>', '0 0 100 100'),
  'assets/more.svg': svg('<circle cx="4" cy="12" r="1.75" fill="#f8fafb"/><circle cx="12" cy="12" r="1.75" fill="#f8fafb"/><circle cx="20" cy="12" r="1.75" fill="#f8fafb"/>'),
  'assets/heart.svg': lineIcon('<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>'),
  'assets/comment.svg': lineIcon('<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>'),
  'assets/send.svg': lineIcon('<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>'),
  'assets/save.svg': lineIcon('<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/>')
}

const image = (id, source, x, y, width, height, zIndex = 30, locked = false) => ({ id, type: 'image', x, y, width, height, src: source, opacity: 1, fit: 'contain', zIndex, locked })
const text = (id, value, x, y, width, height, fontSize, color = '#f8fafb', fontWeight = 700) => ({ id, type: 'text', x, y, width, height, text: value, color, fontSize, fontWeight, align: 'left', fontFamily: 'sans', zIndex: 30 })
const iconY = .901
const iconWidth = .053
const iconHeight = iconWidth * 1200 / 1800
const manifest = {
  schemaVersion: 1,
  id: 'custom-f927f2b1-8fce-40e8-8a09-5f8a336e69ea',
  name: 'LUMA Social Post',
  description: 'Editable social-post frame with individually movable avatar, labels, action icons, and QR.',
  rows: 1, columns: 1, requiredSlots: 1, printLabel: '4 × 6 in postcard',
  output: { width: 1200, height: 1800, ppi: 300 },
  background: { kind: 'solid', color: '#0d1115', secondaryColor: '#0d1115', scale: 8, angle: 0 },
  qrPlacement: { x: .873, y: .94, size: .08 },
  slots: [{ id: 'social-photo', x: .02, y: .08, width: .96, height: .8, shape: 'rounded', radius: .01, fit: 'cover', zIndex: 10 }],
  layers: [
    image('social-background', 'assets/background.svg', 0, 0, 1, 1, 0, true),
    image('social-avatar', 'assets/avatar.svg', .038, .024, .061, .061 * 1200 / 1800),
    text('social-account', 'luma_ptb', .122, .03, .22, .036, 3.15),
    text('social-age', '• 1 week', .355, .033, .25, .031, 2.45, '#aeb5ba', 500),
    image('social-more', 'assets/more.svg', .915, .033, .052, .052 * 1200 / 1800),
    image('social-heart', 'assets/heart.svg', .04, iconY, iconWidth, iconHeight),
    image('social-comment', 'assets/comment.svg', .125, iconY, iconWidth, iconHeight),
    image('social-send', 'assets/send.svg', .21, iconY, iconWidth, iconHeight),
    image('social-save', 'assets/save.svg', .905, iconY, iconWidth, iconHeight),
    text('social-caption', 'luma_ptb  Một ngày đáng nhớ ✨', .04, .947, .75, .041, 2.7)
  ],
  theme: { id: 'night', label: 'After dark', paper: '#0d1115', ink: '#f8fafb', accent: '#d1ee85', slotLight: '#b0cbb4', slotDark: '#57705d' },
  createdAt: new Date().toISOString(), builtIn: false, fontAssets: []
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)), ...Object.fromEntries(Object.entries(assets).map(([name, content]) => [name, strToU8(content)])) }))
process.stdout.write(`${output}\n`)
