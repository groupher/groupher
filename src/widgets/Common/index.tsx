import { type FC, useEffect } from 'react'
import * as NextLink from 'next/link'

import type { TActive, TSpace, TColor } from '~/spec'
import { COLOR_NAME } from '~/const/colors'
import styled, { css, theme, rainbow } from '~/css'

// @ts-ignore
export const LinkAble = styled(NextLink)`
  text-decoration: none;

  &:hover 
    text-decoration: underline;
    cursor: pointer;
  }
`

// @ts-ignore
export const SlientLink = styled(NextLink)`
  text-decoration: none;
  color: ${theme('article.digest')};

  &:hover {
    text-decoration: underline;
    color: ${theme('article.title')};
    cursor: pointer;
  }
`

// @ts-ignore
export const Link = styled(NextLink)<{ maxLength?: string }>`
  color: ${theme('link')};
  text-decoration: none;
  ${({ maxLength }) => css.cutRest(maxLength || '200px')};

  &:hover {
    color: ${theme('link')};
    text-decoration: underline;
    cursor: pointer;
  }
`

export const Row = styled.div`
  ${css.row('align-center')};
`
export const Space = styled.span<TSpace>`
  margin-left: ${({ left }) => `${left}px` || 0};
  margin-right: ${({ right }) => `${right}px` || 0};
`
export const SpaceGrow = styled.div`
  flex-grow: 1;
`
type TDivider = { width?: string } & TSpace
export const Divider = styled.div<TDivider>`
  border-top: 1px solid;
  border-top-color: ${theme('divider')};
  width: ${({ width }) => width || '100%'};
  margin-top: ${({ top }) => `${top === undefined ? 20 : top}px`};
  margin-bottom: ${({ bottom }) => `${bottom === undefined ? 20 : bottom}px`};
`
export const SexyDivider = styled.div<TSpace>`
  height: 1px;
  width: 100%;

  border-bottom: 1px solid transparent;
  border-image: linear-gradient(
    0.35turn,
    transparent,
    ${theme('divider')},
    ${theme('divider')},
    ${theme('divider')},
    transparent
  );

  border-image-slice: 1;

  margin-top: ${({ top }) => `${top === undefined ? 20 : top}px`};
  margin-bottom: ${({ bottom }) => `${bottom === undefined ? 20 : bottom}px`};
`

type TLineDivider = TSpace & { height?: number; opacity?: number }
export const LineDivider = styled.div<TLineDivider>`
  background-color: ${theme('lineDivider')};
  width: 1px;
  height: ${({ height }) => `${height || 12}px`};
  opacity: ${({ opacity }) => `${opacity || 1}`};

  margin-left: ${({ left }) => `${left || 15}px`};
  margin-right: ${({ right }) => `${right || 15}px`};
`
// see https://stackoverflow.com/questions/27900053/css-transition-with-visibility-not-working
export const FadeToggle = styled.div<TActive>`
  visibility: ${({ show }) => (show ? 'visible' : 'hidden')};
  opacity: ${({ show }) => (show ? 1 : 0)};
  transition: visibility 0.3s linear, opacity 0.3s linear;
`

export const Inline = styled.div<TSpace>`
  display: inline-block;
  margin-left: ${({ left }) => `${left || 0}px`};
  margin-right: ${({ right }) => `${right || 0}px`};
`

type TBar = { width?: number; opacity?: number; height?: number } & TSpace

export const Bar = styled.div<TBar>`
  width: ${({ width }) => `${width}px` || '20px'};
  height: ${({ height }) => `${height}px` || '5px'};
  border-radius: 5px;
  opacity: ${({ opacity }) => opacity || 1};

  ${(props) => css.spaceMargins(props)};
`

export const WithMargin = styled.div<TSpace>`
  ${(props) => css.spaceMargins(props)};
`

export const WithPosition = styled.div<TSpace>`
  position: absolute;
  ${({ top }) => (top !== undefined ? `top: ${top}px;` : '')}
  ${({ left }) => (left !== undefined ? `left: ${left}px;` : '')}
  ${({ bottom }) => (bottom !== undefined ? `bottom: ${bottom}px;` : '')}
  ${({ right }) => (right !== undefined ? `right: ${right}px;` : '')}
`

type TBrick = { $width?: number; $height?: number; $radius?: number; $opacity?: number } & TColor
export const Brick = styled(WithPosition)<TBrick>`
  width: ${({ $width }) => `${$width || 20}px`};
  height: ${({ $height }) => `${$height || 6}px`};
  border-radius: ${({ $radius }) => `${$radius || 5}px`};
  opacity: ${({ $opacity }) => `${$opacity || 1}`};
  background: ${({ $color }) => rainbow($color || COLOR_NAME.BLACK, 'article.title')};
`

type TLoadWatcher = {
  onLoad: () => void
}
export const LoadWatcher: FC<TLoadWatcher> = ({ onLoad }) => {
  useEffect(() => {
    if (onLoad) {
      setTimeout(onLoad)
    }
  }, [])

  return <></>
}
