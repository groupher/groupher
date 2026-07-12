import { type RefObject, useEffect, useEffectEvent, useMemo } from 'react'

type OutsideEvent = MouseEvent | TouchEvent

type MaybeRef = RefObject<HTMLElement | null>
type EventWithComposedPath = Event & {
  composedPath?: () => EventTarget[]
}

const isEventInside = (e: Event, refs: MaybeRef[]): boolean => {
  const target = e.target as Node | null
  if (!target) return false

  // 优先使用 composedPath（支持 shadow DOM / portal）
  const path = (e as EventWithComposedPath).composedPath?.()
  if (path) {
    return refs.some((ref) => ref.current && path.includes(ref.current))
  }

  // fallback
  return refs.some((ref) => ref.current?.contains(target))
}

const useOutsideClick = (
  refs: MaybeRef | MaybeRef[],
  onOutside?: (e: OutsideEvent) => void,
): void => {
  const refsArray = useMemo(() => (Array.isArray(refs) ? refs : [refs]), [refs])
  const enabled = Boolean(onOutside)
  const handleOutside = useEffectEvent((event: OutsideEvent): void => {
    onOutside?.(event)
  })

  useEffect(() => {
    if (!enabled) return

    const handler = (e: OutsideEvent) => {
      if (!isEventInside(e, refsArray)) {
        handleOutside(e)
      }
    }

    document.addEventListener('click', handler, true)
    document.addEventListener('touchstart', handler, true)

    return () => {
      document.removeEventListener('click', handler, true)
      document.removeEventListener('touchstart', handler, true)
    }
  }, [enabled, refsArray])
}

export default useOutsideClick
