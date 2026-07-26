const isAllowedLocalHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')

export function openExternalUrl(value: string): void {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !isAllowedLocalHost(url.hostname)) {
    console.error(`Refused to open a non-local service URL: ${url.toString()}`)
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
