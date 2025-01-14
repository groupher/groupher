/*
 *
 * common styles used in styled-component
 *
 */

import styled from 'styled-components'
import type { TSpace } from '~/spec'

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

const smokey = (initOpacity = 0.6): string => `
  opacity: ${initOpacity};

  &:hover {
    opacity: 1;
    cursor: pointer;
  }
  transition: opacity 0.2s;
`

const cutRest = (width = '100px'): string => `
  max-width: ${width};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`
const lineClamp = (num = 1): string => `
  position: relative;
  display: -webkit-box;
  -webkit-line-clamp: ${num};
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
`

/**
 * expand space margin styles
 */
const spaceMargins = (props: TSpace) => {
  const { top = 0, bottom = 0, left = 0, right = 0 } = props

  return `
    margin-top: ${top}px;
    margin-bottom: ${bottom}px;
    margin-left: ${left}px;
    margin-right: ${right}px;
  `
}

const cardShadow = 'rgba(0, 0, 0, 0.1) 0px 0px 5px 0px, rgba(0, 0, 0, 0.1) 0px 0px 1px 0px;'

export const css = {
  cutRest,
  lineClamp,
  circle,
  size,
  smokey,
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
  cardShadow,
  spaceMargins,
}

export { theme, rainbowLink, rainbow, rainbowSoft, rainbowPale, gradientBg } from '../themes'
export { WIDTH } from './metric'
export { default as zIndex, type TZIndexKey } from './zindex'

export { default as animate } from './animations'

export default styled
