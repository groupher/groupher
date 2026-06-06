import {
  getImageCanvasCenter,
  getImagePositionFromCanvasPoint,
  getImageResizeFromCanvasPoint,
} from './metric'

describe('cover image metric helpers', () => {
  it('round-trips the centered cover position through canvas coordinates', () => {
    const center = getImageCanvasCenter({ x: 0.5, y: 0.5 }, 100, 0)

    expect(center).toEqual({ x: 355, y: 200 })
    expect(getImagePositionFromCanvasPoint(center, 100, 0)).toEqual({
      x: 0.5,
      y: 0.5,
    })
  })

  it('keeps corner resize capped at the configured maximum size', () => {
    const resized = getImageResizeFromCanvasPoint({
      handle: 'bottom-right',
      point: { x: 1000, y: 600 },
      rotate: 0,
      startCenter: { x: 355, y: 200 },
      startSize: 100,
    })

    expect(resized).toEqual({
      center: { x: 355, y: 200 },
      size: 100,
    })
  })

  it('shrinks toward the opposite corner when resizing inward', () => {
    const resized = getImageResizeFromCanvasPoint({
      handle: 'bottom-right',
      point: { x: 355, y: 200 },
      rotate: 0,
      startCenter: { x: 355, y: 200 },
      startSize: 100,
    })

    expect(resized).toEqual({
      center: { x: 177.5, y: 100 },
      size: 50,
    })
  })
})
