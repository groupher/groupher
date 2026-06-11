import type { TCoverImageConfig, TCoverPoint } from '../../spec'

const CENTER_POINT_THRESHOLD = 0.001

export const isCenterPoint = (point: TCoverPoint): boolean =>
  Math.abs(point.x - 0.5) < CENTER_POINT_THRESHOLD &&
  Math.abs(point.y - 0.5) < CENTER_POINT_THRESHOLD

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
