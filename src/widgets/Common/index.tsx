import { type FC, useEffect } from 'react'
import * as NextLink from 'next/link'

import styled, { css, theme } from '~/css'

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
