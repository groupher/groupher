import { useEffect, useRef } from 'react'

export default function useInterval(callback: () => void, delay: number | null): void {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return undefined

    const intervalId = window.setInterval(() => callbackRef.current(), delay)
    return () => window.clearInterval(intervalId)
  }, [delay])
}
