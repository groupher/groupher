'use client'

import { useEffect, useState } from 'react'

import useInitialNow from '~/hooks/useInitialNow'
import useLocale from '~/stores/locale/hooks'
import { fmtRelativeTime } from '~/utils/fmt'

type TProps = {
  datetime: string | Date
  tickInterval?: number // auto refresh in every min
}

type TInitialNowWindow = Window & {
  __GROUPHER_INITIAL_NOW__?: number
}

const getRuntimeInitialNow = (): number | null => {
  if (typeof window === 'undefined') return null

  const initialNow = (window as TInitialNowWindow).__GROUPHER_INITIAL_NOW__

  return typeof initialNow === 'number' && Number.isFinite(initialNow) ? initialNow : null
}

export default function TimeAgo({ datetime, tickInterval = 60_000 }: TProps) {
  const { locale } = useLocale()
  const initialNow = useInitialNow()

  const [now, setNow] = useState<number | null>(() => {
    const runtimeNow = getRuntimeInitialNow()

    return initialNow ?? runtimeNow ?? null
  })

  useEffect(() => {
    const updateNow = () => setNow(Date.now())

    setNow(initialNow ?? getRuntimeInitialNow() ?? Date.now())
    const id = setInterval(updateNow, tickInterval)

    return () => clearInterval(id)
  }, [initialNow, tickInterval])

  const dateTime = datetime instanceof Date ? datetime.toISOString() : datetime
  if (now === null) return <time dateTime={dateTime} />

  const text = fmtRelativeTime(datetime, now, locale)

  return <time dateTime={dateTime}>{text}</time>
}
