'use client'

import { useEffect } from 'react'

import type { TPlatformScriptProps } from '~/platform'

export default function CommunityScript({
  dangerouslySetInnerHTML,
  id,
  onError,
  onLoad,
  src,
  strategy = 'afterInteractive',
  ...props
}: TPlatformScriptProps) {
  useEffect(() => {
    const insert = () => {
      const existing = id
        ? document.getElementById(id)
        : src
          ? document.querySelector(`script[src="${src}"]`)
          : null
      if (existing) return
      const script = document.createElement('script')
      if (id) script.id = id
      if (src) script.src = src
      if (dangerouslySetInnerHTML?.__html) script.text = String(dangerouslySetInnerHTML.__html)
      Object.entries(props).forEach(([key, value]) => {
        if (value !== undefined && value !== null && typeof value !== 'function') {
          script.setAttribute(key, value === true ? '' : String(value))
        }
      })
      script.onload = onLoad as (() => void) | null
      script.onerror = onError as (() => void) | null
      document.body.appendChild(script)
    }

    if (strategy === 'lazyOnload' && document.readyState !== 'complete') {
      window.addEventListener('load', insert, { once: true })
    } else {
      insert()
    }

    return () => {
      if (strategy === 'lazyOnload') window.removeEventListener('load', insert)
    }
  }, [dangerouslySetInnerHTML, id, onError, onLoad, props, src, strategy])

  return null
}
