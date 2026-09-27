import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPrinterProfile, paperDimensions } from '../src/shared/printProfile.ts'
import { buildPrintPage, printPageSizeMicrons } from '../src/main/printPage.ts'

test('each printer can use a separately chosen paper profile', () => {
  const office = { paper: 'A5', marginMm: 3, fit: 'contain' }
  const dyeSub = { paper: '4x6', marginMm: 0, fit: 'cover' }
  assert.equal(isPrinterProfile(office), true)
  assert.equal(isPrinterProfile(dyeSub), true)
  assert.deepEqual(paperDimensions(office, false), { widthMm: 148, heightMm: 210 })
  assert.deepEqual(paperDimensions(dyeSub, true), { widthMm: 152.4, heightMm: 101.6 })
  assert.deepEqual(printPageSizeMicrons(148, 210), { width: 148000, height: 210000 })
})

test('invalid media configuration is rejected before a print job', () => {
  assert.equal(isPrinterProfile({ paper: 'toString', marginMm: 3, fit: 'contain' }), false)
  assert.equal(isPrinterProfile({ paper: 'A5', marginMm: -1, fit: 'contain' }), false)
  assert.equal(isPrinterProfile({ paper: 'A5', marginMm: 3, fit: 'stretch' }), false)
})

test('print markup has one non-flowing image with preserved aspect ratio', () => {
  const page = buildPrintPage(148, 210, 3, 'contain')
  assert.match(page, /@page\{size:148mm 210mm;margin:0\}/)
  assert.match(page, /position:absolute/)
  assert.match(page, /object-fit:contain/)
  assert.doesNotMatch(page, /object-fit:fill/)
})
