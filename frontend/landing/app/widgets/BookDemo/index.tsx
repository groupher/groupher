/*
 *
 * BookDemo
 *
 */

import { useState } from 'react'
import Button from '~/widgets/Buttons/Button'
import HomeHeader from '~/unit/home-header'

import useSalon, { cn } from './salon'

export default function BookDemo() {
  const s = useSalon()
  const [showV, setShowV] = useState(false)

  return (
    <div className={s.wrapper}>
      <HomeHeader />
      <div className={s.inner}>
        <div className={s.emoji}>🗓</div>
        <h2 className={s.title}>萍水相逢，感谢关注</h2>
        <p className={s.p}>
          如果你的团队还想进一步了解 Groupher 以确定它是否能满足需求，我们很乐意提供帮助！
        </p>
        <p className={cn(s.p, 'mb-10')}>我们会在约定时间以线上会议的形式提供使用前的各种咨询。</p>
        <p className={s.p}>
          {showV && (
            <>
              请添加微信：<span className='bold-sm'>mydearxym</span>
            </>
          )}
          {!showV && (
            <Button ghost onClick={() => setShowV(true)}>
              预约演示
            </Button>
          )}
        </p>
      </div>
    </div>
  )
}
