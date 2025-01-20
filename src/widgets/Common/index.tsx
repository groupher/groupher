import { type FC, useEffect } from 'react'
import * as NextLink from 'next/link'

import type { TSpace } from '~/spec'
import styled, { css, theme } from '~/css'

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
