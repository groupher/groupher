const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1'])

export function openExternalUrl(value: string): void {
  const url = new URL(value)
  if (url.protocol !== 'http:' || !ALLOWED_HOSTS.has(url.hostname)) {
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
