/*
 *
 * ArrowLink
 *
 */

import { type FC, memo, type ReactNode } from 'react'

import SIZE from '~/const/size'
import ArrowSVG from '~/icons/Arrow'
import type { TSize } from '~/spec'

import useSalon, { cn } from './salon/arrow_link'

type TProps = {
  className?: string
  children?: ReactNode
  size?: TSize
  href: string
  target?: '_blank' | ''
  color?: string
  hoverColor?: string
}

const ArrowLink: FC<TProps> = ({
  className = '',
  children = '下一步',
  size = SIZE.SMALL,
  href = '',
  target = '_blank',
  color = '',
}) => {
  const s = useSalon({ size, color })

  return (
    <a className={cn(s.wrapper, className)} href={href} rel='noopener noreferrer' target={target}>
      <div className={s.text}>{children}</div>
      <ArrowSVG className={s.rightIcon} />
    </a>
  )
}

export default memo(ArrowLink)
