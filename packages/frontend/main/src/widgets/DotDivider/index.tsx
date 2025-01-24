/*
 *
 * DotDivider
 *
 */

import { type FC, memo } from 'react'

import useSalon, { cn } from './salon'

type TProps = {
  className?: string
}

const DotDivider: FC<TProps> = ({ className = '' }) => {
  const s = useSalon()

  return <div className={cn(s.wrapper, className)} />
}

export default memo(DotDivider)
