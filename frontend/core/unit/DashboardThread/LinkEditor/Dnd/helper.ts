import type { Over } from '@dnd-kit/core'

export const getOverRect = (over: Over): DOMRect | typeof over.rect => {
  const getRect = over.data.current?.getRect
  const rect = typeof getRect === 'function' ? getRect() : null

  return rect || over.rect
}
