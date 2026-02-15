/**
 * macOS Notarization script for electron-builder.
 *
 * Called automatically by electron-builder's afterSign hook.
 * Requires these environment variables:
 *   - APPLE_ID: Apple Developer email
 *   - APPLE_APP_SPECIFIC_PASSWORD: App-specific password from appleid.apple.com
 *   - APPLE_TEAM_ID: 10-character team ID from developer.apple.com
 *
 * When env vars are missing, notarization is silently skipped.
 * This allows unsigned dev builds while enabling signed CI builds.
 *
 * Setup steps:
 *   1. Join Apple Developer Program (developer.apple.com, 99 USD/year)
 *   2. Create a "Developer ID Application" certificate
 *   3. Export as .p12, base64-encode: base64 -i cert.p12 | pbcopy
 *   4. Add to GitHub Secrets: CSC_LINK (base64 cert), CSC_KEY_PASSWORD
 *   5. Generate app-specific password at appleid.apple.com/account/manage
 *   6. Add to GitHub Secrets: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
 */

const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return
  }

  // Skip if credentials are not configured
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('[Notarize] Skipping — APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID not set')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`[Notarize] Submitting ${appPath} to Apple...`)

  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })

  console.log('[Notarize] Done — app has been notarized')
}
