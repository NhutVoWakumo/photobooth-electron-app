const { app, shell } = require('electron')
const assert = require('node:assert/strict')
const { mkdtemp } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

app.on('window-all-closed', () => {})

async function main() {
  app.setPath('userData', await mkdtemp(join(tmpdir(), 'luma-oauth-qc-')))
  global.__LUMA_GOOGLE_CLIENT_ID__ = '123456-abc.apps.googleusercontent.com'
  const drive = await import('../src/main/drive.ts')
  const realFetch = global.fetch
  const tokenGrants = []
  shell.openExternal = async url => {
    const auth = new URL(url)
    assert.equal(auth.searchParams.get('client_id'), global.__LUMA_GOOGLE_CLIENT_ID__)
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
    const callback = new URL(auth.searchParams.get('redirect_uri'))
    callback.searchParams.set('code', 'synthetic-code')
    callback.searchParams.set('state', auth.searchParams.get('state'))
    await realFetch(callback)
  }
  global.fetch = async (url, init = {}) => {
    const target = String(url)
    if (target === 'https://oauth2.googleapis.com/token') {
      const params = init.body
      assert.equal(params.has('client_secret'), false, 'Public native client must never ship a secret')
      tokenGrants.push(params.get('grant_type'))
      if (params.get('grant_type') === 'authorization_code') {
        assert.ok(params.get('code_verifier'))
        return new Response(JSON.stringify({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 0 }), { status: 200 })
      }
      assert.equal(params.get('refresh_token'), 'synthetic-refresh')
      return new Response(JSON.stringify({ access_token: 'synthetic-refreshed', expires_in: 3600 }), { status: 200 })
    }
    if (target.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      return new Response(JSON.stringify({ files: [{ id: 'synthetic-root' }] }), { status: 200 })
    }
    throw new Error(`Unexpected OAuth QC URL: ${target}`)
  }
  assert.equal((await drive.driveStatus()).configured, true)
  await drive.connectDrive()
  assert.equal((await drive.driveStatus()).connected, true)
  assert.deepEqual(tokenGrants, ['authorization_code', 'refresh_token'])
  console.log('PASS fresh install, system-browser PKCE, no client secret, token refresh, Drive root')
}

app.whenReady().then(main).then(() => app.quit()).catch(error => {
  console.error(error)
  process.exit(1)
})
