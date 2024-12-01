/*
 *
 * ReadableDate
 *
 */

import { type FC, memo } from 'react'

import AbsoluteFmt from './AbsoluteFmt'

type TProps = {
  date: string
  withTime?: boolean
  className?: string
}

const ReadableDate: FC<TProps> = ({ className = 'readable-date', withTime = true, date }) => {
  return (
    <div className={className}>
      <AbsoluteFmt datetime={date} className={className} withTime={withTime} />
    </div>
  )
}

export default memo(ReadableDate)
