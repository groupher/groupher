import { type FC, Fragment, memo } from 'react'

import useSalon from './salon/absolute_fmt'
import { cnMerge } from '~/css'

const calcRange = (hours) => {
  if (hours >= 0 && hours <= 6) return '凌晨'

  return hours > 12 ? '下午' : '上午'
}

type TProps = {
  datetime: string
  className: string
  withTime: boolean
}

const AbsoluteFmt: FC<TProps> = ({ datetime, className, withTime }) => {
  const s = useSalon()

  const DateObj = new Date(datetime)

  const year = DateObj.getFullYear()
  const month = DateObj.getMonth() + 1
  const day = DateObj.getDate()
  const hours = DateObj.getHours()
  const range = calcRange(hours)
  const hour = hours > 12 ? hours - 12 : hours

  return (
    <div className={cnMerge(s.wrapper, className)}>
      {year}
      <div className='mr-0.5' />
      年
      <div className='mr-0.5' />
      {month}
      <div className='mr-0.5' />
      月
      <div className='mr-0.5' />
      {day}
      <div className='mr-0.5' /> 日
      {withTime && (
        <Fragment>
          <div className='mr-0.5' />
          {range}
          <div className='mr-0.5' />
          {hour}
          <div className='mr-0.5' />
        </Fragment>
      )}
    </div>
  )
}

export default memo(AbsoluteFmt)
