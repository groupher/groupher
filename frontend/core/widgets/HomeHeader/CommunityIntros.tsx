'use client'

import type { FC } from 'react'

import KanbanSVG from '~/icons/Kanban'
import PeopleSVG from '~/icons/People'
import GithubSVG from '~/icons/social/Github'
import WeChatSVG from '~/icons/social/WeChat'
import ChangelogSVG from '~/icons/TadaRaw'

import useSalon, { cn } from './salon/community_intro'

const CommunityIntros: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.block}>
        <div className={s.blockGrey} />
        <div className={s.head}>
          <PeopleSVG className={s.menuIcon} />
          <div className={s.title}>官方论坛</div>
        </div>
        <div className={s.desc}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
      </div>

      <div className={s.block}>
        <div className={s.blockGrey} />
        <div className={s.head}>
          <KanbanSVG className={cn(s.menuIcon, 'rotate-180')} />
          <div className={s.title}>开发进度</div>
        </div>
        <div className={s.desc}>开发计划，产品路线图，反馈进度等。</div>
      </div>

      <div className={s.block}>
        <div className={s.blockGrey} />
        <div className={s.head}>
          <ChangelogSVG className={s.menuIcon} />
          <div className={s.title}>更新日志</div>
        </div>
        <div className={s.desc}>产品更新详情，历史版本发布记录。</div>
      </div>

      <div className={s.block}>
        <div className={s.blockGrey} />
        <div className={s.head}>
          <GithubSVG className={s.menuIcon} />
          <div className={s.title}>Github</div>
        </div>
        <div className={s.desc}>常见问题，使用引导，开发指南等</div>
      </div>

      <div className={s.block}>
        <div className={s.blockGrey} />
        <div className={s.head}>
          <WeChatSVG className={s.menuIcon} />
          <div className={s.title}>微信群</div>
        </div>
        <div className={s.desc}>常见问题，使用引导，开发指南等</div>
      </div>
    </div>
  )
}

export default CommunityIntros
