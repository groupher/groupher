import type { FC } from 'react'

import type { TSizeSML, TSpace, TUser } from '~/spec'
import Avatar from './Avatar'

export type TAvatarProps = {
  testid?: string
  className?: string
  user?: TUser
  title?: string
  size?: TSizeSML
  quote?: boolean
} & TSpace

const ImgFallback: FC<TAvatarProps> = (props) => {
  return <Avatar {...props} />
}

export default ImgFallback
