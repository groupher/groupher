import Link from 'next/link'
import { type FC, useState } from 'react'

import { ROUTE } from '~/const/route'
import useSession from '~/hooks/useSession'
import ArrowSVG from '~/icons/ArrowSimple'
import BookSVG from '~/icons/Book'
import DiscussSVG from '~/icons/DiscussSolid'
import KanbanSVG from '~/icons/Kanban'
import ChangelogSVG from '~/icons/TadaRaw'
import CommunityBrand from '~/widgets/CommunityBrand'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon'

const HomeHeader: FC = () => {
  const s = useSalon()

  const [productActive, setProductActive] = useState(false)
  const [moreActive, setMoreActive] = useState(false)

  useSession()

  return (
    <>
      <Link href='/' className={s.brand}>
        <CommunityBrand landingBrand />
      </Link>
      <div className={s.links}>
        <Tooltip
          content={
            <div className={cn(s.panel, 'w-52 mt-1 mb-1.5')}>
              <Link className={cn(s.menuBar, '!items-start')} href={`/${ROUTE.HOME}`}>
                <div className={cn(s.menuIconBox, s.purpleBg)}>
                  <DiscussSVG className={cn(s.menuIcon, s.purpleIcon)} />
                </div>
                <div>
                  <div className={cn(s.menuTitle, 'bold-sm')}>讨论区</div>
                  <div className={s.menuDesc}>功能需求，问题上报，常规讨论等</div>
                </div>
              </Link>
              <Link
                className={cn(s.menuBar, '!items-start')}
                href={`/${ROUTE.HOME}/${ROUTE.KANBAN}`}
              >
                <div className={cn(s.menuIconBox, s.blueBg)}>
                  <KanbanSVG className={cn(s.menuIcon, 'rotate-180', s.blueIcon)} />
                </div>
                <div>
                  <div className={cn(s.menuTitle, 'bold-sm')}>看板</div>
                  <div className={s.menuDesc}>开发计划，产品路线图</div>
                </div>
              </Link>
              <Link
                className={cn(s.menuBar, '!items-start')}
                href={`/${ROUTE.HOME}/${ROUTE.CHANGELOG}`}
              >
                <div className={cn(s.menuIconBox, s.redBg)}>
                  <ChangelogSVG className={cn(s.menuIcon, 'size-4', s.redIcon)} />
                </div>
                <div>
                  <div className={cn(s.menuTitle, 'bold-sm')}>更新日志</div>
                  <div className={s.menuDesc}>产品更新详情，历史版本发布记录。</div>
                </div>
              </Link>
              <Link className={cn(s.menuBar, '!items-start')} href={`/${ROUTE.HOME}/${ROUTE.HELP}`}>
                <div className={cn(s.menuIconBox, s.cyanBg)}>
                  <BookSVG className={cn(s.menuIcon, 'size-5', s.cyanIcon)} />
                </div>
                <div>
                  <div className={cn(s.menuTitle, 'bold-sm')}>帮助文档</div>
                  <div className={s.menuDesc}>常见问题，使用引导，开发指南等</div>
                </div>
              </Link>
            </div>
          }
          placement='bottom'
          offset={[-5, 5]}
          onShow={() => setProductActive(true)}
          onHide={() => setProductActive(false)}
          delay={100}
          noPadding
        >
          <div className={cn(s.stackLink, productActive && s.linkActive)}>
            产品 <ArrowSVG className={s.arrowIcon} />
          </div>
        </Tooltip>

        <Link className={s.linkItem} href={`/${ROUTE.HOME}`}>
          社区
        </Link>
        <Link className={s.linkItem} href={`/${ROUTE.HOME}/${ROUTE.KANBAN}`}>
          开发计划
        </Link>
        <Link className={s.linkItem} href={`/${ROUTE.PRICE}`}>
          价格
        </Link>
        <Tooltip
          content={
            <div className={s.panel}>
              <Link className={s.menuBar} href={`/${ROUTE.HOME}`}>
                <div className={s.menuTitle}>团队博客</div>
              </Link>
              <Link className={s.menuBar} href={`/${ROUTE.HOME}/${ROUTE.DASHBOARD.OVERVIEW}`}>
                <div className={s.menuTitle}>帮助文档</div>
              </Link>
              <Link className={s.menuBar} href={`/${ROUTE.HOME}/${ROUTE.DASHBOARD.OVERVIEW}`}>
                <div className={s.menuTitle}>更新日志</div>
              </Link>
              <Link className={s.menuBar} href={`/${ROUTE.HOME}/${ROUTE.DASHBOARD.OVERVIEW}`}>
                <div className={s.menuTitle}>自定义</div>
              </Link>
            </div>
          }
          placement='bottom'
          trigger='mouseenter focus'
          offset={[-5, 5]}
          onShow={() => setMoreActive(true)}
          onHide={() => setMoreActive(false)}
          delay={100}
          noPadding
        >
          <div className={cn(s.stackLink, moreActive && s.linkActive)}>
            了解更多 <ArrowSVG className={s.arrowIcon} />
          </div>
        </Tooltip>
      </div>

      {/* <div className={s.extraInfo}>
        <ThemeSwitch />
        <div className={s.divider} />
        <Link className={s.requestDemoLink} href={`/${ROUTE.BOOK_DEMO}`}>
          <DemoSVG className={s.demoIcon} />
          <div>预约演示</div>
        </Link>
      </div> */}
    </>
  )
}

export default HomeHeader
