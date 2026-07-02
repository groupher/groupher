'use client'

import { useEffect, useState } from 'react'

import useInitialNow from '~/hooks/useInitialNow'
import useLocale from '~/stores/locale/hooks'
import { fmtRelativeTime } from '~/utils/fmt'

type TProps = {
  datetime: string | Date
  tickInterval?: number // auto refresh in every min
}

export default function TimeAgo({ datetime, tickInterval = 60_000 }: TProps) {
  const { locale } = useLocale()
  const initialNow = useInitialNow()

  const [now, setNow] = useState<number | null>(initialNow ?? null)

  useEffect(() => {
    const updateNow = () => setNow(Date.now())

    updateNow()
    const id = setInterval(updateNow, tickInterval)

    return () => clearInterval(id)
  }, [tickInterval])

  const dateTime = datetime instanceof Date ? datetime.toISOString() : datetime
  if (now === null) return <time dateTime={dateTime} />

  const text = fmtRelativeTime(datetime, now, locale)

  return <time dateTime={dateTime}>{text}</time>
}
