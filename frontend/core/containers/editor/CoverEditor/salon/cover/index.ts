import { pixelAdd } from '~/dom'

import { IMAGE_CONTAINER_SIZE, LINEAR_BORDER } from '../../constant'

import { getImageTranslate, getLinearBorder, getImageSize, getLightPos } from '../metric'

import useTwBelt from '~/hooks/useTwBelt'

export default ({ linearBorderPos }) => {
  const { cn, br } = useTwBelt()

  const getBorderColor = (linearBorderPos) => {
    if (linearBorderPos === LINEAR_BORDER.ALL) {
      return br('text.digest')
    }

    return ''
  }

  return {
    wrapper: cn('rounded relative overflow-hidden border', br('divider')),
    wrapperStyle: {
      width: IMAGE_CONTAINER_SIZE.WIDTH,
      height: IMAGE_CONTAINER_SIZE.HEIGHT,
    },
    glassBorder: 'relative align-both trans-all-200',
    image: cn('trans-all-200 object-cover', getBorderColor(linearBorderPos)),
    light: 'absolute size-96 trans-all-200 bg-blend-lighten pointer-events-none z-30',

    // helpers
    pixelAdd,
    getImageSize,
    getImageTranslate,
    getLinearBorder,
    getLightPos,
  }
}
