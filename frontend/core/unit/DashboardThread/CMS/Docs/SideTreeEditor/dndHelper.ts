import { CSS, type Transform } from '@dnd-kit/utilities'

const MIN_TRANSLATE_X = -18
const MAX_TRANSLATE_X = 28

const clampTranslateX = (x: number): number =>
  Math.max(MIN_TRANSLATE_X, Math.min(MAX_TRANSLATE_X, x))

// SideTree groups have different heights, so dnd-kit may emit scale transforms
// while sorting. Keep only bounded translation to avoid squeezing text/icons or
// letting the drag preview drift far outside the narrow side tree.
export const toTranslateOnlyTransform = (transform: Transform | null): string | undefined => {
  if (!transform) return undefined

  return CSS.Transform.toString({
    ...transform,
    x: clampTranslateX(transform.x),
    scaleX: 1,
    scaleY: 1,
  })
}
