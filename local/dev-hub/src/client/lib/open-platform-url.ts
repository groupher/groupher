import { openUrl } from './open-url'

export function openPlatformUrl(value: string): void {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    console.error(`Refused to open an unsupported platform URL: ${url.toString()}`)
    return
  }

  openUrl(url)
}
