import { Clock3 } from 'lucide-react'
import { useEffect, useState } from 'react'

type TProps = {
  startedAt: number
}

export function Uptime({ startedAt }: TProps) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <span className='uptime'>
      <Clock3 aria-hidden='true' />
      <span>{formatUptime(Math.max(0, now - startedAt))}</span>
    </span>
  )
}

function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000)
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainder = seconds % 60

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`
}
