import { COVER_SCENES } from '../../../const/coverScenes'

export const SIDE_COUNT = Math.floor(COVER_SCENES.length / 2)
const GAP = 18
const COVER_HEIGHT = 640

export type TCoverSlot = {
  x: number
  width: number
  height: number
}

export type TCoverTransition = { to: number; shift: number }

/** A scene keeps its identity while its position rotates around the active scene. */
export const getCoverSlot = (sceneIndex: number, activeIndex: number): number => {
  const forward = (sceneIndex - activeIndex + COVER_SCENES.length) % COVER_SCENES.length
  return forward > SIDE_COUNT ? forward - COVER_SCENES.length : forward
}

export const getCoverGeometry = (slot: number, galleryWidth: number): TCoverSlot => {
  const tileWidth = Math.min(96, Math.max(64, galleryWidth * 0.05))
  const coverWidth = Math.min(
    940,
    Math.max(0, galleryWidth - tileWidth * SIDE_COUNT * 2 - GAP * SIDE_COUNT * 2),
  )

  if (slot === 0) return { x: -coverWidth / 2, width: coverWidth, height: COVER_HEIGHT }

  const distance = Math.abs(slot)
  return {
    x:
      slot < 0
        ? -coverWidth / 2 - distance * (tileWidth + GAP)
        : coverWidth / 2 + GAP + (distance - 1) * (tileWidth + GAP),
    width: tileWidth,
    height: Math.max(128, 640 - distance * 128),
  }
}
