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

  // A managed desktop tab is a subframe; Tauri injects its API only in the shell.
  const params = new URLSearchParams(window.location.search)
  if (window.parent !== window && params.has('devhubRoot') && params.has('devhubInstance')) {
    window.parent.postMessage({ type: 'groupher-devhub-open-url', url: target }, '*')
    return
  }

  window.open(target, '_blank', 'noopener,noreferrer')
}
