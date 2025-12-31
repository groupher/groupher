'use client'

import { useEffect, useState } from 'react'
import useLocale from '~/hooks/useLocale'
import useNow from '~/hooks/useNow'
import { fmtRelativeTime } from '~/utils/fmt'

type TProps = {
  datetime: string | Date
  tickInterval?: number // auto refresh in every min
}

export default function TimeAgo({ datetime, tickInterval = 60_000 }: TProps) {
  const nowFromStore = useNow()
  const { locale } = useLocale()

  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), tickInterval)
    return () => clearInterval(id)
  }, [tickInterval])

  const now = tick === 0 ? nowFromStore : Date.now()
  const text = fmtRelativeTime(datetime, now, locale)

  return <time dateTime={datetime instanceof Date ? datetime.toISOString() : datetime}>{text}</time>
}
