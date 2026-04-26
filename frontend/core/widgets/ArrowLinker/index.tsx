/*
 *
 * ArrowLinker
 *
 */

import Link from 'next/link'
import type { FC, ReactNode } from 'react'

import ArrowSVG from '~/icons/ArrowUpRight'
import type { TColorName, TSpace } from '~/spec'

import useSalon, { cn } from './salon'

type TProps = {
  testid?: string
  href?: string
  children: ReactNode
  target?: string
  bold?: boolean
  color?: TColorName | null
  noColor?: boolean
  withSoftBg?: boolean
  className?: string
} & TSpace

const ArrowLinker: FC<TProps> = ({
  testid = 'arrow-linker',
  href = '/',
  target = '_blank',
  bold: _bold = false,
  color = null,
  noColor = false,
  withSoftBg = false,
  className = '',
  children,
  ...spacing
}) => {
  const s = useSalon({ color, noColor, withSoftBg, ...spacing })

  return (
    <Link href={href} target={target} className='inline-block'>
      <div className={cn(s.wrapper, className)} data-testid={testid}>
        <div className={s.title}>{children}</div>
        <ArrowSVG className={s.arrowIcon} />
      </div>
    </Link>
  )
}

export default ArrowLinker
