import { useState } from 'react'
import useMobileDetect from '@groupher/use-mobile-detect-hook'

import { BANNER_LAYOUT } from '~/const/layout'

import FileTree from '~/widgets/FileTree'
import FeedbackFooter from '~/widgets/FeedbackFooter'
import Sticky from '~/widgets/Sticky'

import useLayout from '~/hooks/useLayout'

import PinedTree from './PinedTree'
import FaqLayout from '../FaqLayout'
import NaviHead from './NaviHead'
import ArticleCover from './ArticleCover'

import ToggleBtn from './ToggleBtn'

import useLogic from '../useLogic'
import useSalon from '../salon/article_layout'

export default () => {
  const { gotoDetailLayout, isFAQArticleLayout } = useLogic()
  const [outlineOpen, setOutlineOpen] = useState(true)

  const s = useSalon({ outlineOpen })

  const { isMobile } = useMobileDetect()
  const { bannerLayout } = useLayout()

  return (
    <div className={s.wrapper}>
      {!outlineOpen && (
        <div className="animate-fade-left animate-duration-300">
          <Sticky offsetTop={50}>
            <div className="h-fit">
              <ToggleBtn
                open={false}
                onToggle={(toggle) => setOutlineOpen(toggle)}
                className="mt-1 top-16"
              />
            </div>
          </Sticky>
        </div>
      )}

      {!isMobile && bannerLayout !== BANNER_LAYOUT.SIDEBAR && (
        <div className={s.sidebar}>
          <PinedTree />
          <Sticky offsetTop={30}>
            <div className="h-fit">
              {outlineOpen && (
                <ToggleBtn open={outlineOpen} onToggle={(toggle) => setOutlineOpen(toggle)} />
              )}
              <FileTree onSelect={() => gotoDetailLayout()} left={0} />
            </div>
          </Sticky>
        </div>
      )}

      <div className={s.content}>
        <div className={s.header}>
          {!isFAQArticleLayout && <NaviHead />}
          {!isFAQArticleLayout && <h1 className={s.title}>关于帮助台的使用</h1>}
          {!isFAQArticleLayout && <ArticleCover />}
        </div>

        {isFAQArticleLayout ? (
          <div className={s.faq}>
            <FaqLayout left={50} />
          </div>
        ) : (
          <>
            <div>
              巴西内马尔积极在禁区外围游走，但是双方传控始终胶着，球不到禁区就被截断了。个人感觉巴西实力更强，但上半场要我说，克罗地亚打的更好。
            </div>
            <br />
            <div>
              Moving to the slightly larger 512-byte messages, we can see the total throughput seems
              to drop for each individual client, but fRPC is still comfortably 2-3x faster than
              gRPC is. In the case of 8192 connected clients, fRPC’s throughput is still 98
              RPCs/second while gRPC drops to only 29.
            </div>

            <br />
            <div>
              伊朗是民众思想开放 但政府是保守的神棍 民众很多对宗教不感冒 不想围头巾 想喝酒
              过世俗的生活 自然会抗争 而且伊朗本身就有较大的社会矛盾
            </div>
            <br />
            <div>
              To make sure our benchmark is fair, we’ll be using the exact same proto3 file as the
              input for both fRPC and gRPC. Moreover, we’ll be using the exact same service
              implementation for both the gRPC and fRPC servers - the generated service interfaces
              in fRPC are designed to look the same as in gRPC, so using the same service
              implementation is extremely simple.
            </div>
          </>
        )}
        {!isFAQArticleLayout && <FeedbackFooter top={60} />}
      </div>
    </div>
  )
}
