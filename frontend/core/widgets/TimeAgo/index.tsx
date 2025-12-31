'use client'

import { useEffect, useState } from 'react'
import useLocale from '~/hooks/useLocale'
import useNow from '~/hooks/useNow'
import { fmtRelativeTime } from '~/utils/fmt'

type TProps = {
  datetime: string | Date
  tickInterval?: number // refresh every 1 min
}

export default function TimeAgo({ datetime, tickInterval = 60_000 }: TProps) {
  const nowFromStore = useNow()
  const { locale } = useLocale()

  const [_tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
    }, tickInterval)
    return () => clearInterval(id)
  }, [tickInterval])

  const text = fmtRelativeTime(datetime, nowFromStore, locale)

  return <time dateTime={datetime instanceof Date ? datetime.toISOString() : datetime}>{text}</time>
}
