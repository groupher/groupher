import { useEffect, useRef } from 'react'

type Cleanup = () => void
type MountEffect = (...args: never[]) => unknown

const useMount = (effect: MountEffect): void => {
  const effectRef = useRef(effect)
  effectRef.current = effect

  useEffect(() => {
    const result = effectRef.current()
    if (typeof result === 'function') {
      return result as Cleanup
    }
  }, [])
}

export default useMount
