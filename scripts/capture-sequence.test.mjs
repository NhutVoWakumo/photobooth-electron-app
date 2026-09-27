import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/renderer/src/lib/appendCapture.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { appendCapture } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`)

test('a timed multi-photo sequence keeps earlier shots and completes the frame', () => {
  const frame = { id: 'frame', templateId: 'test', createdAt: '0', updatedAt: '0', status: 'draft', photos: [], assignments: [null, null, null, null] }
  let session = { id: 'session', name: 'Test', createdAt: '0', updatedAt: '0', frames: [frame] }
  for (let slot = 0; slot < 4; slot += 1) {
    const photo = { id: `photo-${slot}`, dataUrl: `data:${slot}`, capturedAt: String(slot + 1), pinned: false, slotAspectRatio: 1 }
    session = appendCapture(session, 'frame', slot, photo)
    assert.deepEqual(session.frames[0].assignments.slice(0, slot + 1), Array.from({ length: slot + 1 }, (_, index) => `photo-${index}`))
    assert.equal(session.frames[0].photos.length, slot + 1)
  }
  assert.equal(session.frames[0].status, 'complete')
  session = appendCapture(session, 'frame', 2, { id: 'retake', dataUrl: 'data:new', capturedAt: '5', pinned: false, slotAspectRatio: 1 })
  assert.deepEqual(session.frames[0].assignments, ['photo-0', 'photo-1', 'retake', 'photo-3'])
  assert.equal(session.frames[0].photos.length, 5)
})
