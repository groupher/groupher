'use client'

import type { FC } from 'react'

import BookSVG from '~/icons/Book'
import DiscussSVG from '~/icons/DiscussSolid'
import KanbanSVG from '~/icons/Kanban'
import ChangelogSVG from '~/icons/TadaRaw'

import useSalon, { cn } from './salon/feature_intro'

const FeatureIntros: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.block)}>
        <div className={s.blockPurple} />
        <div className={s.head}>
          <DiscussSVG className={cn(s.menuIcon, s.purpleIcon)} />
          <div className={cn(s.title, s.purple)}>讨论区</div>
        </div>
        <div className={s.desc}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
      </div>

      <div className={cn(s.block)}>
        <div className={s.blockBlue} />
        <div className={s.head}>
          <KanbanSVG className={cn(s.menuIcon, s.blueIcon)} />
          <div className={cn(s.title, s.blue)}>看板</div>
        </div>
        <div className={s.desc}>开发计划，产品路线图，反馈进度等。</div>
      </div>

      <div className={cn(s.block)}>
        <div className={s.blockRed} />
        <div className={s.head}>
          <ChangelogSVG className={cn(s.menuIcon, s.redIcon)} />
          <div className={cn(s.title, s.red)}>更新日志</div>
        </div>
        <div className={s.desc}>产品更新详情，历史版本发布记录。</div>
      </div>

      <div className={cn(s.block)}>
        <div className={s.blockCyan} />
        <div className={s.head}>
          <BookSVG className={cn(s.menuIcon, s.cyanIcon)} />
          <div className={cn(s.title, s.cyan)}>帮助文档</div>
        </div>
        <div className={s.desc}>常见问题，使用引导，开发指南等</div>
      </div>
    </div>
  )
}

export default FeatureIntros
