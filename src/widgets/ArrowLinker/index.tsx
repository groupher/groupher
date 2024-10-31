/*
 *
 * ArrowLinker
 *
 */

import type { FC, ReactNode } from 'react'
import Link from 'next/link'

import type { TColorName, TSpace } from '~/spec'

import ArrowSVG from '~/icons/ArrowUpRight'

import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
  href?: string
  children: ReactNode
  target?: string
  bold?: boolean
  color?: TColorName | null
  withSoftBg?: boolean
  className?: string
} & TSpace

const ArrowLinker: FC<TProps> = ({
  testid = 'arrow-linker',
  href = '/',
  target = '_blank',
  bold = false,
  color = null,
  withSoftBg = false,
  className = '',
  children,
  ...spacing
}) => {
  const s = useSalon({ color, withSoftBg, ...spacing })

  return (
    <Link href={href} target={target}>
      <div className={cn(s.wrapper, className)} data-testid={testid}>
        <div className={s.title}>{children}</div>
        <ArrowSVG className={s.arrowIcon} />
      </div>
    </Link>
  )
}

export default ArrowLinker
