# Google Drive for LUMA Booth

Drive sharing is optional. Sessions and original captures remain on this computer even when Drive is disconnected. The app asks for the narrow `drive.file` scope, not full-drive access.

## For booth operators

Open **Settings → General → Google Drive**. On a fresh installation, choose **Choose Google setup file** and select your own Desktop OAuth JSON downloaded from Google Cloud. The app reads that file locally, saves the configuration on this computer, then opens the browser for you to approve your Google account. If the setup is already saved, use **Connect Google Drive** to sign in again. You do not need to type the client ID or secret into the app. Photos stay local until QR is enabled for a session with completed frames.

## One-time setup for each operator

1. Open [Google Cloud Console](https://console.cloud.google.com/) with the Google account you want to use. Create or choose a project.
2. Enable **Google Drive API** for that project.
3. Set up the OAuth consent screen. For a personal Google account, choose **External**; while in Testing mode, add your Google account as a test user. Google may expire refresh tokens after 7 days in Testing mode, so reconnect when requested.
4. Create an OAuth client of type **Desktop app** and download its JSON file. Keep the file private on your computer; never commit it or paste its contents into an issue or chat.
5. In the installed app, select that JSON under **Settings → General → Google Drive** and complete Google sign-in. If the Google app is in Testing mode, your account must be listed as a test user. Google may expire refresh tokens after 7 days in Testing mode, so reconnect when requested.

Release builds contain no Google OAuth client ID, client secret, access token, refresh token, or preconnected account. GitHub Actions needs no Google secrets. Every installation begins without Drive configuration and stores its own setup and tokens in that machine's Electron user-data directory. Keep the downloaded OAuth JSON and machine user data private; do not copy them into the source repository or release assets.

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
