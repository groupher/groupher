import type { TCoverImageConfig, TCoverPoint } from '../../spec'

const CENTER_POINT_THRESHOLD = 0.001

/** Reports whether center point at the frontend shared boundary. */
export const isCenterPoint = (point: TCoverPoint): boolean =>
  Math.abs(point.x - 0.5) < CENTER_POINT_THRESHOLD &&
  Math.abs(point.y - 0.5) < CENTER_POINT_THRESHOLD

/** Returns border value for the frontend shared workflow. */
export const getBorderValue = ({
  borderRadius,
  borderHighlight,
  glassBorder,
}: Pick<TCoverImageConfig, 'borderHighlight' | 'borderRadius' | 'glassBorder'>): string => {
  const value = [
    borderRadius > 0 ? '角' : '',
    borderHighlight.enabled ? '光' : '',
    glassBorder.enabled ? '框' : '',
  ]
    .filter(Boolean)
    .join('/')

  return value || '0'
}
