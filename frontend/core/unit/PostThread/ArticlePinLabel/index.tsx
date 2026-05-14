/*
 *
 * ArticlePinLabel
 *
 */

import type { FC } from 'react'

import PinSVG from '~/icons/Pin'

import useSalon, { cn } from './salon'

type TProps = {
  className?: string
  isPinned?: boolean
}
const ArticlePinLabel: FC<TProps> = ({ isPinned, className }) => {
  const s = useSalon()

  if (isPinned) return <PinSVG className={cn(s.pinIcon, className)} />

  return null
}

export default ArticlePinLabel
