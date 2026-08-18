'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'urql'

import useTrans from '~/hooks/useTrans'

import useSalon from './salon'
import { ANALYSIS_ACTIVE_VISITORS_QUERY } from './schema'

const REFRESH_INTERVAL = 60_000

type TProps = {
  community: string
}

type TData = {
  analysisActiveVisitors: { visitors: number } | null
}

type TStatus = 'ready' | 'stale' | 'unavailable'

type TState = {
  status: TStatus
  visitors: number | null
}

const unavailableState = (): TState => ({ status: 'unavailable', visitors: null })

export default function RealtimeOnline({ community }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const [visible, setVisible] = useState(true)
  const [state, setState] = useState<TState>(unavailableState)
  const [result, reexecuteQuery] = useQuery<TData>({
    query: ANALYSIS_ACTIVE_VISITORS_QUERY,
    variables: { community },
    pause: !visible,
    requestPolicy: 'network-only',
  })

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState === 'visible')
    onVisibilityChange()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (!visible) return

    const interval = window.setInterval(() => {
      reexecuteQuery({ requestPolicy: 'network-only' })
    }, REFRESH_INTERVAL)

    return () => window.clearInterval(interval)
  }, [reexecuteQuery, visible])

  useEffect(() => {
    if (result.fetching) return

    if (result.error || result.data?.analysisActiveVisitors === null) {
      setState((previous) =>
        previous.visitors === null ? unavailableState() : { ...previous, status: 'stale' },
      )
      return
    }

    const visitors = result.data?.analysisActiveVisitors?.visitors
    if (typeof visitors === 'number' && visitors >= 0) {
      setState({ status: 'ready', visitors })
      return
    }

    setState((previous) =>
      previous.visitors === null ? unavailableState() : { ...previous, status: 'stale' },
    )
  }, [result.data, result.error, result.fetching])

  if (state.visitors === null) {
    return (
      <div className={s.wrapper} aria-label={t('dsb.analysis.online_unavailable')}>
        <span className={s.value}>—</span>
        <span className={s.stale}>{t('dsb.analysis.online_unavailable')}</span>
      </div>
    )
  }

  if (state.status === 'stale') {
    return (
      <div className={s.wrapper} aria-label={t('dsb.analysis.online_unavailable')}>
        <span className={s.value}>{state.visitors}</span>
        <span className={s.stale}>{t('dsb.analysis.online_unavailable')}</span>
      </div>
    )
  }

  return (
    <div className={s.wrapper} aria-label={`${state.visitors} ${t('dsb.analysis.online')}`}>
      <span className={s.value}>{state.visitors}</span>
      <span className={s.status}>
        <span className={s.dot} aria-hidden='true'>
          <span className={s.dotPing} />
          <span className={s.dotCore} />
        </span>
        {t('dsb.analysis.online')}
      </span>
    </div>
  )
}
