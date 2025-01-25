import type { ReactNode } from 'react'

import type { TColorName } from '~/spec'

import useSalon, { cn } from '../salon/users_wall'

export const P1 = (markColor: TColorName): ReactNode => {
  const s = useSalon()
  const color$ = markColor.toLowerCase()

  return (
    <div className={s.demoP}>
      从 Github Discussions 迁移到 Groupher 以后，
      <span className={cn(s.highlight, s[`${color$}Bg`])}>国内访问体验拉满</span>
      ，收集到的用户反馈也更加有针对性，很好的解决了
      <span className={cn(s.highlight, s[`${color$}Bg`])}>我们和用户</span>之间的交流需求。
    </div>
  )
}

export const P2 = (markColor: TColorName): ReactNode => {
  const s = useSalon()
  const color$ = markColor.toLowerCase()

  return (
    <div className={s.demoP}>
      作为一个小团队，实在没有精力每天维护多个微信群，Groupher 完全是一个
      <span className={cn(s.highlight, s[`${color$}Bg`])}>定制化的交流社区</span>，
      沉淀了功能请求和问题反馈等 ，让各种讨论可以
      <span className={cn(s.highlight, s[`${color$}Bg`])}>随时检索回溯</span>，
      <div className={s.p}>更新日志的板块设计巧妙</div>
    </div>
  )
}

export const P3 = (markColor: TColorName): ReactNode => {
  const s = useSalon()
  const color$ = markColor.toLowerCase()

  return (
    <div className={s.demoP}>
      其他全国所有的省份，没有一个人均产量超过700公斤的，其中2021年
      <span className={cn(s.highlight, s[`${color$}Bg`])}>新疆，安徽，河南三省</span>
      人均都是600多公斤，辽宁省人均刚好600公斤，这四个省份也是最接近
      黑吉蒙的，但是可以看出人均也只有黑吉蒙的一半都不到。
      <div className={s.p}>
        我们再说四川省，四川省 一直被认为是中国的
        <span className={cn(s.highlight, s[`${color$}Bg`])}>战略备份省份</span>
        ，除了地势易守难攻，地理位置远离强敌之外，四川省在资源禀赋方面也是有自己的优势的。
      </div>
    </div>
  )
}
