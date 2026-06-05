import { SETTING_LEVEL } from '../../constant'
import type { TCoverPoint, TTuningSetting } from '../../spec'
import { LEVEL_VALUE } from './constant'

const CENTER_POINT_THRESHOLD = 0.001

export const isCenterPoint = (point: TCoverPoint): boolean =>
  Math.abs(point.x - 0.5) < CENTER_POINT_THRESHOLD &&
  Math.abs(point.y - 0.5) < CENTER_POINT_THRESHOLD

export const getBorderValue = ({
  borderHighlight,
  borderRadiusLevel,
  hasGlassBorder,
}: Pick<TTuningSetting, 'borderHighlight' | 'borderRadiusLevel' | 'hasGlassBorder'>): string => {
  const value = [
    borderRadiusLevel !== SETTING_LEVEL.L1 ? `R${LEVEL_VALUE[borderRadiusLevel]}` : '',
    borderHighlight.enabled ? '光' : '',
    hasGlassBorder ? '框' : '',
  ]
    .filter(Boolean)
    .join('/')

  return value || '0'
}
