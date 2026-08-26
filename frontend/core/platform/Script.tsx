'use client'

import { useEffect } from 'react'

import type { TScriptProps } from './context'

const LOADED = 'data-groupher-loaded'

const findExistingScript = (id?: string, src?: string): HTMLScriptElement | null => {
  if (id) return document.getElementById(id) as HTMLScriptElement | null
  if (!src) return null
  return (
    Array.from(document.scripts).find(
      (script) => script.src === new URL(src, document.baseURI).href,
    ) ?? null
  )
}

export default function Script({
  dangerouslySetInnerHTML,
  id,
  onError,
  onLoad,
  src,
  strategy = 'afterInteractive',
  ...attributes
}: TScriptProps) {
  const attributeEntries = Object.entries(attributes).filter(
    ([, value]) => value !== undefined && value !== null && typeof value !== 'function',
  )
  const attributeKey = attributeEntries
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('\u0000')

  useEffect(() => {
    let cancelled = false
    let idleId: number | null = null
    let timeoutId: number | null = null
    let loadListener: (() => void) | null = null
    let scriptElement: HTMLScriptElement | null = null
    let ownsScript = false

    const handleLoad = (event: Event) => {
      const script = event.currentTarget as HTMLScriptElement
      script.setAttribute(LOADED, '')
      if (!cancelled) onLoad?.(event as never)
    }
    const handleError = (event: Event) => {
      if (!cancelled) onError?.(event as never)
    }
    const insert = () => {
      if (cancelled) return
      const existing = findExistingScript(id, src)
      if (existing) {
        scriptElement = existing
        if (existing.hasAttribute(LOADED)) {
          queueMicrotask(() => {
            if (!cancelled) onLoad?.({ currentTarget: existing } as never)
          })
        } else {
          existing.addEventListener('load', handleLoad, { once: true })
          existing.addEventListener('error', handleError, { once: true })
        }
        return
      }

      const script = document.createElement('script')
      scriptElement = script
      ownsScript = true
      if (id) script.id = id
      if (src) script.src = src
      script.async = true
      for (const [key, value] of attributeEntries) {
        script.setAttribute(key, value === true ? '' : String(value))
      }
      if (dangerouslySetInnerHTML?.__html) script.text = String(dangerouslySetInnerHTML.__html)
      script.addEventListener('load', handleLoad, { once: true })
      script.addEventListener('error', handleError, { once: true })
      document.body.appendChild(script)
      if (!src) script.setAttribute(LOADED, '')
    }

    if (strategy === 'lazyOnload') {
      const scheduleIdle = () => {
        if (typeof window.requestIdleCallback === 'function') {
          idleId = window.requestIdleCallback(insert)
        } else {
          timeoutId = window.setTimeout(insert, 1)
        }
      }
      if (document.readyState === 'complete') scheduleIdle()
      else {
        loadListener = scheduleIdle
        window.addEventListener('load', loadListener, { once: true })
      }
    } else insert()

    return () => {
      cancelled = true
      if (loadListener) window.removeEventListener('load', loadListener)
      if (idleId !== null) window.cancelIdleCallback?.(idleId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      scriptElement?.removeEventListener('load', handleLoad)
      scriptElement?.removeEventListener('error', handleError)
      if (ownsScript && !scriptElement?.hasAttribute(LOADED)) scriptElement?.remove()
    }
  }, [attributeKey, dangerouslySetInnerHTML, id, onError, onLoad, src, strategy])

  return null
}
