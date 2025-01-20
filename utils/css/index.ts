/*
 *
 * common styles used in styled-component
 *
 */

import styled from 'styled-components'

import { twMerge } from 'tailwind-merge'
import { clsx, type ClassValue } from 'clsx'

import { mediaBreakPoints } from './metric'
import { media, fitContentWidth, fitStickerWidth, fitPageWidth } from './media'
import { flex, flexGrow, flexWrap, flexColumn, flexColumnGrow, flexColumnWrap } from './flex'

import { circle, size } from './shape'

/**
 * Prevents output of unnecessary Tailwind classes and merges classes.
 * usefull tips from: https://www.youtube.com/watch?v=re2JFITR7TI
 *
 * @param inputs - Any number of class names or class name arrays.
 * @returns A string of merged class names.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const css = {
  circle,
  size,
  row: flex,
  rowWrap: flexWrap,
  rowGrow: flexGrow,
  column: flexColumn,
  columnGrow: flexColumnGrow,
  columnWrap: flexColumnWrap,
  mediaBreakPoints,
  media,
  fitContentWidth,
  fitStickerWidth,
  fitPageWidth,
}

export { theme, rainbowLink, rainbow, rainbowSoft, rainbowPale, gradientBg } from '../themes'
export { WIDTH } from './metric'
export { default as zIndex, type TZIndexKey } from './zindex'

export { default as animate } from './animations'

export default styled
