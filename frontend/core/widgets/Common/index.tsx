import { type FC, useEffect } from 'react'

type TLoadWatcher = {
  onLoad: () => void
}
export const LoadWatcher: FC<TLoadWatcher> = ({ onLoad }) => {
  useEffect(() => {
    if (!onLoad) return

    const timer = setTimeout(onLoad)

    return () => clearTimeout(timer)
  }, [onLoad])

  return null
}
