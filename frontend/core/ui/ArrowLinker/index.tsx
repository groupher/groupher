/*
 *
 * ArrowLinker
 *
 */

import type { FC, ReactNode } from 'react'

import { cnMerge } from '~/css'
import ArrowSVG from '~/icons/ArrowUpRight'
import { Link } from '~/platform'
import type { TColorName, TSpace } from '~/spec'

import useSalon from './salon'

type TProps = {
  testid?: string
  href?: string
  children: ReactNode
  target?: string
  bold?: boolean
  color?: TColorName | null
  noColor?: boolean
  withLiteBg?: boolean
  className?: string
} & TSpace

const ArrowLinker: FC<TProps> = ({
  testid = 'arrow-linker',
  href = '/',
  target = '_blank',
  bold: _bold = false,
  color = null,
  noColor = false,
  withLiteBg = false,
  className = '',
  children,
  ...spacing
}) => {
  const s = useSalon({ color, noColor, withLiteBg, ...spacing })

  return (
    <Link href={href} navigation='document' target={target} className='inline-block'>
      <div className={cnMerge(s.wrapper, className)} data-testid={testid}>
        <div className={s.title}>{children}</div>
        <ArrowSVG className={s.arrowIcon} />
      </div>
    </Link>
  )
}

export default ArrowLinker
