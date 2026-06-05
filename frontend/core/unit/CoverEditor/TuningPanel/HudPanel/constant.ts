import { IMAGE_RATIO } from '../../constant'
import type { TImageRadio } from '../../spec'

export const RATIO_VALUE: Record<TImageRadio, string> = {
  [IMAGE_RATIO.SCREEN]: '16:9',
  [IMAGE_RATIO.TV]: '4:3',
  [IMAGE_RATIO.SQUARE]: '1:1',
}
