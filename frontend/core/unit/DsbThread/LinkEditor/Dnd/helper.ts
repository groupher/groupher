import type { Over } from '@dnd-kit/core'

/** Returns over rect for the frontend shared workflow. */
export const getOverRect = (over: Over): DOMRect | typeof over.rect => {
  const getRect = over.data.current?.getRect
  const rect = typeof getRect === 'function' ? getRect() : null

  return rect || over.rect
}
