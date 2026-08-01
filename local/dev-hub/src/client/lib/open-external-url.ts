import { openUrl } from './open-url'

const isAllowedLocalHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')

export function openExternalUrl(value: string): void {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !isAllowedLocalHost(url.hostname)) {
    console.error(`Refused to open a non-local service URL: ${url.toString()}`)
    return
  }

  openUrl(url)
}
