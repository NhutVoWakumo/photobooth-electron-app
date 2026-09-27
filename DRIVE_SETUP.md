# Google Drive for LUMA Booth

Drive sharing is optional. Sessions and original captures remain on this computer even when Drive is disconnected. The app asks for the narrow `drive.file` scope, not full-drive access.

## For booth operators

Open **Settings → General → Google Drive** and choose **Connect Google Drive**. Sign in with your own Google account in the system browser and approve Drive access. No JSON file or credential entry is needed in a configured release build. Photos stay local until QR is enabled for a session with completed frames.

## One-time setup for the app owner

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or choose one LUMA project.
2. Enable **Google Drive API** for that project.
3. Set up the OAuth consent screen as **External**. While in Testing mode, add each friend's Google email as a test user. Google may expire refresh tokens after 7 days in Testing mode, so users may need to reconnect.
4. Create an OAuth client of type **Desktop app**. The **client ID only** goes into the GitHub repository variable `LUMA_GOOGLE_CLIENT_ID` before building a release. Do not add its client secret, the downloaded JSON, or any user's token to Git, GitHub Actions variables/secrets, or an installer.
5. The release workflow checks that the variable exists and injects only that public ID into the desktop app. Each user then signs in to their own Drive in Settings.

Google's [installed-app OAuth guidance](https://developers.google.com/identity/protocols/oauth2/native-app) states that desktop apps cannot keep secrets; the client secret is optional for token exchange and refresh. The public client ID in an installer is extractable, even if encrypted or obfuscated. Every installation begins with no account or token. PKCE protects each authorization-code exchange, and each user's tokens stay in that machine's Electron user-data directory. No backend service is needed for this native-app flow.

For development or a private custom OAuth project, **Advanced setup** still accepts a Desktop OAuth JSON stored locally. That file and any locally saved client secret are never packaged or uploaded by the release workflow.

On first connection, the app looks for an app-visible `LUMA Booth` folder at the top level of My Drive and creates it if missing. All session folders are created inside this one root; frame folders are created inside their session. The app stores the root folder ID and reuses it on later runs. The `drive.file` scope cannot search arbitrary folders that the app has never created or been granted, so a same-named folder manually created outside the app may not be discoverable.

Connecting alone does not upload photos. QR is on by default for a session when Drive is connected, and off when Drive is unavailable. You can switch it off in that session. With QR on, completed frames are uploaded automatically, including the composed JPEG and the component JPEGs. **View QR** for a frame opens only that frame's folder.

With QR on, the app also shares that session folder and displays its QR. Incomplete frames are skipped. Switching QR off revokes the public permissions for both the session and its frame folders; local photos stay intact. The root folder and other sessions remain private. A session QR intentionally exposes every uploaded frame under that session to anyone holding the link.

Each uploaded final frame image includes a QR in the lower-right corner by default. Its starting print size is roughly 15 mm so it remains scannable on narrow strips. In Frame Studio, choose the default position and size for each design. In **Print / export**, drag the QR only if you want to override that position for a particular frame. The editor creates a real Drive link automatically before exporting or printing; when QR is off or Drive is disconnected, it exports or prints without a QR.

## Operational behavior

- Failed/offline uploads remain queued on this computer. The app retries on startup and periodically while open; use **Retry** in the session when a sync fails.
- Uploading an edited frame updates existing files. Removed component photos are deleted from its shared folder after a successful resync.
- A frame QR is valid for 30 days after its latest successful upload. The app revokes the public permission and moves the frame folder to Drive Trash after expiry. If the app is closed or offline at the deadline, this happens the next time it runs and can reach Drive; expiry is **not guaranteed at the exact second** without an always-on service.
- Deleting a local frame or session queues revocation and moving the corresponding app-created Drive folder to Trash. If offline, that removal waits in the local queue.
- The app stores OAuth tokens encrypted through Electron's OS-backed `safeStorage` when available. If secure storage is unavailable, the login survives only until the app closes.
- Sharing the entire private session folder with a client is deliberately separate from frame QR access. Do not make the parent folder public: doing so would expose every frame and defeat individual QR expiry. In this version, hand off a session by sharing its private parent folder directly in Drive with the client's Google account.

## Validation boundary

`npm run qc:drive` uses synthetic image bytes and mocked Google responses; it does not access your account. It checks offline queueing, isolated frame permissions, idempotent updates, stale-photo deletion, and expiry/deletion cleanup. A live upload and QR scan still require your Google login and a real completed frame.
