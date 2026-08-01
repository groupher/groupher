export function openUrl(url: URL): void {
  const target = url.toString()

  if ('__TAURI_INTERNALS__' in window) {
    void import('@tauri-apps/plugin-opener')
      .then(({ openUrl }) => openUrl(target))
      .catch((error: unknown) => {
        console.error(`Failed to open ${target} in the default browser.`, error)
      })
    return
  }

  window.open(target, '_blank', 'noopener,noreferrer')
}
