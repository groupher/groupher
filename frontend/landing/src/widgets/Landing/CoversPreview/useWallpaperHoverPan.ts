import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

type TAnimation = ReturnType<typeof animate>

/** Combines hover panning with scroll panning and stops the previous hover animation on change. */
export default function useWallpaperHoverPan(
  hoverDistance: number,
  scrollPan?: MotionValue<number>,
) {
  const reducedMotion = useReducedMotion() ?? false
  const hoverPan = useMotionValue(0)
  const pan = useTransform(() => (scrollPan?.get() ?? 0) + hoverPan.get())
  const animation = useRef<TAnimation | null>(null)

  useEffect(() => () => animation.current?.stop(), [])

  const setHovered = useCallback(
    (hovered: boolean) => {
      animation.current?.stop()
      const target = hovered && !reducedMotion ? hoverDistance : 0
      if (reducedMotion) {
        hoverPan.set(target)
        return
      }
      animation.current = animate(hoverPan, target, {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      })
    },
    [hoverDistance, hoverPan, reducedMotion],
  )

  return { pan, setHovered }
}
