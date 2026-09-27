import assert from 'node:assert/strict'
import test from 'node:test'
import { openCameraStream } from '../src/renderer/src/lib/cameraAccess.ts'

const failure = name => Object.assign(new Error(name), { name })
const stream = { getTracks: () => [] }

test('expired saved camera ID falls back to another camera', async () => {
  const calls = []
  const devices = { async getUserMedia(constraints) {
    calls.push(constraints)
    if (constraints.video.deviceId) throw failure('NotFoundError')
    return stream
  } }
  assert.equal(await openCameraStream(devices, 'old-device-id'), stream)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].video.deviceId.exact, 'old-device-id')
  assert.equal(calls[1].video.deviceId, undefined)
})

test('unsupported high-resolution mode falls back to generic video', async () => {
  const calls = []
  const devices = { async getUserMedia(constraints) {
    calls.push(constraints)
    if (constraints.video !== true) throw failure('OverconstrainedError')
    return stream
  } }
  assert.equal(await openCameraStream(devices), stream)
  assert.deepEqual(calls.map(call => call.video === true), [false, true])
})

test('permission denial is reported without trying other devices', async () => {
  let calls = 0
  const devices = { async getUserMedia() { calls++; throw failure('NotAllowedError') } }
  await assert.rejects(openCameraStream(devices, 'saved-device'), { name: 'NotAllowedError' })
  assert.equal(calls, 1)
})
