'use client'

import { useCallback, useEffect, useState } from 'react'

import { Script } from '~/platform'

const DEFAULT_SOURCES = ['/widget/v1.js', 'http://localhost:5173/v1.js']
const SCRIPT_ID = 'groupher-widget-v1-script'

type TWidgetApi = {
  (...args: unknown[]): void
  q?: ArrayLike<unknown>[]
}

type TWidgetErrorDetail = {
  message?: string
}

type TProps = {
  community: string
  sources?: readonly string[]
}

/**
 * Read the installed Widget API or create its queue-compatible bootstrap stub.
 */
const getWidgetApi = (): TWidgetApi => {
  const windowWithWidget = window as Window & { GroupherWidget?: TWidgetApi }

  if (windowWithWidget.GroupherWidget) return windowWithWidget.GroupherWidget

  const api = ((...args: unknown[]) => {
    ;(api.q = api.q || []).push(args)
  }) as TWidgetApi

  windowWithWidget.GroupherWidget = api
  return api
}

/**
 * Normalize the route community before deriving the v1 demo Widget key.
 */
const resolveWidgetKey = (community: string): string => {
  const normalized = community
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
  return `widget_public_${normalized}`
}

/**
 * Load and boot the v1 Widget preview through the active frontend platform.
 */
export default function WidgetPreviewLoader({ community, sources = DEFAULT_SOURCES }: TProps) {
  const [scriptSources] = useState(() => Array.from(new Set(sources)))
  const [sourceIndex, setSourceIndex] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const scriptSource = scriptSources[sourceIndex]
  const widgetKey = resolveWidgetKey(community)

  useEffect(() => {
    getWidgetApi()('boot', { widgetKey, position: 'bottom-right', mock: true })

    return () => {
      getWidgetApi()('shutdown')
    }
  }, [widgetKey])

  useEffect(() => {
    const onWidgetError = (event: Event) => {
      const detail = (event as CustomEvent<TWidgetErrorDetail>).detail
      setLoadError(detail?.message || 'Widget runtime failed to load.')
    }

    window.addEventListener('groupher-widget:error', onWidgetError)
    return () => window.removeEventListener('groupher-widget:error', onWidgetError)
  }, [])

  const handleScriptError = useCallback(() => {
    setSourceIndex((currentIndex) => {
      if (currentIndex + 1 < scriptSources.length) {
        setLoadError(null)
        return currentIndex + 1
      }

      setLoadError('Widget script failed to load from every configured source.')
      return currentIndex
    })
  }, [scriptSources.length])

  return (
    <>
      <Script
        key={scriptSource}
        id={`${SCRIPT_ID}-${sourceIndex}`}
        src={scriptSource}
        strategy='afterInteractive'
        data-environment='dashboard-v1-prototype'
        onError={handleScriptError}
      />
      {loadError ? <p className='mt-3 text-sm text-red-600'>{loadError}</p> : null}
    </>
  )
}
