export const normalizeSignedAngle = (angle: number): number => {
  const rounded = Math.round(angle)
  const normalized = ((rounded % 360) + 360) % 360

  if (normalized === 180 && rounded < 0) return -180
  return normalized > 180 ? normalized - 360 : normalized
}

export const circularAngleDistance = (angle: number, target: number): number => {
  const diff = Math.abs(normalizeSignedAngle(angle) - normalizeSignedAngle(target))

  return Math.min(diff, 360 - diff)
}
