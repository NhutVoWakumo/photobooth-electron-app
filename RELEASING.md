# Releasing LUMA Booth

Installers are produced by `.github/workflows/release.yml`. This project currently publishes unsigned internal-test builds and requires no custom GitHub secrets.

## Internal test builds

The workflow uses the repository's automatic `GITHUB_TOKEN`. It creates:

- macOS Apple Silicon DMG and ZIP
- macOS Intel DMG and ZIP
- Windows x64 NSIS installer

These builds are not signed or notarized. macOS testers may need **System Settings → Privacy & Security → Open Anyway**. Windows testers may need **More info → Run anyway** in SmartScreen.

## Signing later

When the app is ready for public distribution, configure the following GitHub Actions secrets and re-enable signing/notarization in the build config.

### macOS secrets

- `MAC_CERTIFICATE`: base64-encoded Apple **Developer ID Application** `.p12` certificate.
- `MAC_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`.
- `APPLE_ID`: Apple ID belonging to the Apple Developer team.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password created at `appleid.apple.com`.
- `APPLE_TEAM_ID`: 10-character Apple Developer Team ID.

The Apple Developer Program membership must be active. Export the certificate from Keychain Access only after creating it through the Apple Developer account. Never commit the certificate or passwords.

### Windows secrets

- `WINDOWS_CERTIFICATE`: base64-encoded trusted code-signing `.pfx` certificate.
- `WINDOWS_CERTIFICATE_PASSWORD`: password protecting the `.pfx`.

A self-signed certificate does not remove SmartScreen warnings on other computers. Use a certificate from a publicly trusted code-signing provider. EV certificates generally build reputation faster, while standard certificates are usually cheaper.

## Create a release

1. Update `version` in `package.json` and `package-lock.json`.
2. Commit the change.
3. Create and push a matching tag, for example:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

GitHub Actions builds and attaches these assets to the release:

- macOS Apple Silicon DMG and ZIP
- macOS Intel DMG and ZIP
- Windows x64 NSIS installer

## Security

Certificate files, private keys, passwords, and Apple credentials belong only in GitHub Actions secrets. Do not paste them into issues, commits, workflow files, chat, or build logs.
