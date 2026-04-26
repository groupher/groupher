'use client'

/* *
 * AboutThread
 */

import type { FC } from 'react'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useCommunity from '~/stores/community/hooks'
import Markdown from '~/widgets/Markdown'

import BasicStates from './BasicStates'
import ExtraInfo from './ExtraInfo'
import Members from './Members'
import useSalon, { cn } from './salon'
import Sidebar from './Sidebar'

type TProps = {
  isSidebarLayout?: boolean
}

const INTRO = `我注意到里面他说了一句话，是这个老兄说一会我们的大使也有问题要问您，也就是说这个节目里印度的大使是在场的。
也就是说这个主持人所表达的意思，印度大使全听见了，并且是默许认可的。可以说也就是大使想说的话，也就是说这也代表了印度官方的态度。
只是由一个主持人代为说了出来。这其实很有启发，就是说将来我们的驻美大使是不是也可以采取这样的套路，
找一个懂媒体懂政治的学者在前面替自己怼人，自己默默坐在后面为学者的话背书。`

const AboutThreadContainer: FC<TProps> = ({ isSidebarLayout = false }) => {
  const s = useSalon({ isSidebarLayout })

  const { communityLayout } = useLayout()
  const { moderators } = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <div className={s.intro}>
          <div className={s.title}>社区简介</div>
          <div className={s.desc}>
            <Markdown>{INTRO}</Markdown>
          </div>
        </div>

        {communityLayout === COMMUNITY_LAYOUT.SIDEBAR && <ExtraInfo />}

        <div className={cn(s.intro, s.state)}>
          <div className={s.title}>社区概况</div>
          <BasicStates />
          <div className={s.divider} />
        </div>

        <div className={cn(s.intro, s.members)}>
          <Members moderators={moderators} />
        </div>
      </div>
      {(communityLayout === COMMUNITY_LAYOUT.CLASSIC ||
        communityLayout === COMMUNITY_LAYOUT.HERO) && <Sidebar />}
    </div>
  )
}

export default AboutThreadContainer
