const ROTATE_CLASS_MAP: Record<number, string> = {
  [-6]: '-rotate-6',
  [-3]: '-rotate-3',
  [-2]: '-rotate-2',
  0: 'rotate-0',
  2: 'rotate-2',
  3: 'rotate-3',
  6: 'rotate-6',
  12: 'rotate-12',
}

export const getRotateClass = (angle: number | undefined): string =>
  ROTATE_CLASS_MAP[angle ?? 0] ?? 'rotate-0'
