import type { CSSProperties } from 'react'

import { BORDER_HIGHLIGHT_COLOR } from '../../../../../constant'
import { normalizeBorderHighlightRainbowHue } from '../../../../../helper'
import { CHECKER_BACKGROUND, RAINBOW_STOPS } from './constant'

export const getRainbowGradient = (direction: string, rainbowHue = 0): string =>
  `linear-gradient(${direction}, ${RAINBOW_STOPS.map((stop) => {
    const hue = normalizeBorderHighlightRainbowHue(stop + rainbowHue)

    return `hsl(${hue}, ${BORDER_HIGHLIGHT_COLOR.RAINBOW_SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.RAINBOW_LIGHTNESS}%)`
  }).join(', ')})`

export const getLayeredBackgroundStyle = (image: string): CSSProperties => ({
  backgroundImage: [image, ...CHECKER_BACKGROUND.images].join(', '),
  backgroundPosition: ['0 0', ...CHECKER_BACKGROUND.positions].join(', '),
  backgroundRepeat: ['no-repeat', ...CHECKER_BACKGROUND.repeats].join(', '),
  backgroundSize: ['100% 100%', ...CHECKER_BACKGROUND.sizes].join(', '),
})

export const getHueTrackStyle = (): CSSProperties => ({
  backgroundImage: `linear-gradient(to right,
    hsl(0, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(60, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(120, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(180, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(240, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(300, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(360, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%))`,
  backgroundPosition: '0 0',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 100%',
})

export const getSwatchStyle = (color: string): CSSProperties =>
  getLayeredBackgroundStyle(`linear-gradient(${color}, ${color})`)

export const getRainbowStyle = (rainbowHue = 0, direction = 'to bottom'): CSSProperties =>
  getLayeredBackgroundStyle(getRainbowGradient(direction, rainbowHue))
