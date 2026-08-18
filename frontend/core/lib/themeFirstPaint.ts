import { THEME_FIRST_PAINT_STYLE_ID } from '~/const/theme'

type TCancel = () => void

/** Runs the remove theme first paint vars operation at the frontend shared boundary. */
export const removeThemeFirstPaintVars = (): void => {
  if (typeof document === 'undefined') return

  document.getElementById(THEME_FIRST_PAINT_STYLE_ID)?.remove()
}

/** Runs the schedule remove theme first paint vars operation at the frontend shared boundary. */
export const scheduleRemoveThemeFirstPaintVars = (): TCancel => {
  if (typeof window === 'undefined') return () => {}

  let canceled = false
  let frame: number | null = null
  let timer: number | null = null

  const remove = () => {
    if (canceled) return

    removeThemeFirstPaintVars()
  }

  if (typeof window.requestAnimationFrame !== 'function') {
    timer = window.setTimeout(remove, 0)
  } else {
    frame = window.requestAnimationFrame(remove)
  }

  return () => {
    canceled = true

    if (frame !== null) window.cancelAnimationFrame(frame)
    if (timer !== null) window.clearTimeout(timer)
  }
}
