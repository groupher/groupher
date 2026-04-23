/*
 *
 * DotDivider
 *
 */

import { type FC, memo } from 'react'

import useSalon, { cnMerge } from './salon'

type TProps = {
  className?: string
}

const DotDivider: FC<TProps> = ({ className = '' }) => {
  const s = useSalon()

  return <div className={cnMerge(s.wrapper, className)} />
}

export default memo(DotDivider)
