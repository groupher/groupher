import type { FC } from 'react'

import { num2Percent } from '~/helper'
import LoadingGapSVG from '~/icons/LoadingGap'
import Img from '~/Img'

import useSalon, { cn } from '../../salon/battery_bento/bundle_size/panel'
import { MAX_SIZE, PRODUCTS } from './constant'

type TProps = {
  hovering: boolean
}

const Panel: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {PRODUCTS.map((item, index) => {
        const $good = index === 0
        const $suck = index > 3

        return (
          <div key={item.title} className={cn(!hovering && item.opacity)}>
            <div className={s.header}>
              <div className={s.iconBox}>
                <Img src={item.icon} className={cn(item.iconSize || 'size-3')} />
              </div>
              <h4 className={cn(s.title, $good && s.textGreen)}>{item.title}</h4>
              {hovering && index > 3 && <LoadingGapSVG className={s.loading} />}
              <div className='grow' />
              <h4 className={cn(s.size, $good && s.textGreen, hovering && $suck && s.textRed)}>
                {item.size}
              </h4>
            </div>
            <div className={s.barTrack}>
              <div
                className={cn(s.bar, $good && s.barGreen, hovering && $suck && s.barRed)}
                style={{ width: num2Percent(item.sizeNum / MAX_SIZE) }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Panel
