import type { TFeedbackMood } from './spec'

const MOODS: TFeedbackMood[] = [
  { label: '非常不满意', color: '#ef4444', eyeOffset: 1, browRotate: -12, mouthCurve: -8 },
  { label: '不太满意', color: '#f97316', eyeOffset: 0.5, browRotate: -6, mouthCurve: -5 },
  { label: '一般', color: '#facc15', eyeOffset: 0, browRotate: 0, mouthCurve: 0 },
  { label: '满意', color: '#a3e635', eyeOffset: -0.5, browRotate: -6, mouthCurve: 6 },
  { label: '非常满意', color: '#22c55e', eyeOffset: -1, browRotate: -8, mouthCurve: 9 },
]

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const mix = (from: number, to: number, ratio: number): number => from + (to - from) * ratio

const hexToRgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

const mixColor = (from: string, to: string, ratio: number): string => {
  const a = hexToRgb(from)
  const b = hexToRgb(to)

  return rgbToHex([mix(a[0], b[0], ratio), mix(a[1], b[1], ratio), mix(a[2], b[2], ratio)])
}

export const normalizeScore = (score: number): number => clamp(score, 0, 100)

export const getMood = (score: number): TFeedbackMood => {
  const safeScore = normalizeScore(score)
  const segment = Math.min(Math.floor(safeScore / 25), MOODS.length - 2)
  const ratio = (safeScore - segment * 25) / 25
  const from = MOODS[segment]
  const to = MOODS[segment + 1]

  return {
    label: safeScore >= 100 ? MOODS[MOODS.length - 1].label : to.label,
    color: mixColor(from.color, to.color, ratio),
    eyeOffset: mix(from.eyeOffset, to.eyeOffset, ratio),
    browRotate: mix(from.browRotate, to.browRotate, ratio),
    mouthCurve: mix(from.mouthCurve, to.mouthCurve, ratio),
  }
}

export const getMoodLabel = (score: number): string => getMood(score).label
