import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// A native OAuth client ID is public. Never inject a client secret or a user token.
const googleClientId = process.env.LUMA_GOOGLE_CLIENT_ID ?? ''
if (googleClientId && !/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) {
  throw new Error('LUMA_GOOGLE_CLIENT_ID must be a Google Desktop OAuth client ID.')
}

export default defineConfig({
  main: {
    define: { __LUMA_GOOGLE_CLIENT_ID__: JSON.stringify(googleClientId) },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
