import { type FC, useEffect } from 'react'

type TLoadWatcher = {
  onLoad: () => void
}
export const LoadWatcher: FC<TLoadWatcher> = ({ onLoad }) => {
  useEffect(() => {
    if (onLoad) {
      setTimeout(onLoad)
    }
  }, [])

  return <></>
}
