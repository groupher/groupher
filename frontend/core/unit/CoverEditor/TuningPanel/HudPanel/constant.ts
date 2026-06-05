import { IMAGE_RATIO, SETTING_LEVEL } from '../../constant'
import type { TImageRadio, TSettingLevel } from '../../spec'

export const RATIO_VALUE: Record<TImageRadio, string> = {
  [IMAGE_RATIO.SCREEN]: '16:9',
  [IMAGE_RATIO.TV]: '4:3',
  [IMAGE_RATIO.SQUARE]: '1:1',
}

export const LEVEL_VALUE: Record<TSettingLevel, string> = {
  [SETTING_LEVEL.L1]: '0',
  [SETTING_LEVEL.L2]: '1',
  [SETTING_LEVEL.L3]: '2',
  [SETTING_LEVEL.L4]: '3',
  [SETTING_LEVEL.L5]: '4',
}
