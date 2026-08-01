export function openPlatformUrl(value: string): void {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    console.error(`Refused to open an unsupported platform URL: ${url.toString()}`)
    return
  }

  if ('__TAURI_INTERNALS__' in window) {
    void import('@tauri-apps/plugin-opener')
      .then(({ openUrl }) => openUrl(url.toString()))
      .catch((error: unknown) => {
        console.error(`Failed to open ${url.toString()} in the default browser.`, error)
      })
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
