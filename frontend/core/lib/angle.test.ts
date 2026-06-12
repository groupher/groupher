import { describe, expect, it } from 'vitest'

import { circularAngleDistance, normalizeSignedAngle } from './angle'

describe('normalizeSignedAngle', () => {
  it('keeps the editor angle model in the -180..180 range', () => {
    expect(normalizeSignedAngle(0)).toBe(0)
    expect(normalizeSignedAngle(13)).toBe(13)
    expect(normalizeSignedAngle(180)).toBe(180)
    expect(normalizeSignedAngle(181)).toBe(-179)
    expect(normalizeSignedAngle(270)).toBe(-90)
    expect(normalizeSignedAngle(350)).toBe(-10)
    expect(normalizeSignedAngle(359)).toBe(-1)
    expect(normalizeSignedAngle(-180)).toBe(-180)
    expect(normalizeSignedAngle(-181)).toBe(179)
    expect(normalizeSignedAngle(-360)).toBe(0)
  })
})

describe('circularAngleDistance', () => {
  it('measures equivalent positive and negative angles across the zero boundary', () => {
    expect(circularAngleDistance(-1, 0)).toBe(1)
    expect(circularAngleDistance(359, 0)).toBe(1)
    expect(circularAngleDistance(-179, 180)).toBe(1)
  })
})
