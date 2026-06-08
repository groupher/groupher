import { getCanvasPointFromClient, getImagePositionFromCanvasPoint } from '../../../../salon/metric'
import type { TCoverPoint, TImageSize } from '../../../../spec'
import { KEYBOARD_DELTA } from './constant'

type TPositionParams = {
  size: TImageSize
  rotate: number
}

export const clampPosition = ({ x, y }: TCoverPoint): TCoverPoint => ({
  x: Math.min(1, Math.max(0, x)),
  y: Math.min(1, Math.max(0, y)),
})

export const getPositionFromPointer = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  { size, rotate }: TPositionParams,
): TCoverPoint =>
  getImagePositionFromCanvasPoint(getCanvasPointFromClient(clientX, clientY, rect), size, rotate)

export const getPositionFromKeyboard = (position: TCoverPoint, key: string): TCoverPoint | null => {
  const nextPosition = {
    x: position.x,
    y: position.y,
  }

  if (key === 'ArrowLeft') nextPosition.x -= KEYBOARD_DELTA
  else if (key === 'ArrowRight') nextPosition.x += KEYBOARD_DELTA
  else if (key === 'ArrowUp') nextPosition.y -= KEYBOARD_DELTA
  else if (key === 'ArrowDown') nextPosition.y += KEYBOARD_DELTA
  else return null

  return clampPosition(nextPosition)
}
