/*
 *
 * ImgFallback
 *
 */

import type { FC } from 'react'

import type { TSpace, TUser } from '~/spec'

import Avatar from './Avatar'

export type TAvatarProps = {
  testid?: string
  className?: string
  user?: TUser
  title?: string
  size?: number
  quote?: boolean
} & TSpace

type TProps = TAvatarProps

const ImgFallback: FC<TProps> = ({ ...restProps }) => {
  return <Avatar {...restProps} />
}

export default ImgFallback
