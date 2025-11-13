import Link from 'next/link'
import { type FC, useState } from 'react'

import { ROUTE } from '~/const/route'
import useSession from '~/hooks/useSession'
import ArrowSVG from '~/icons/ArrowSimple'
import CommunityBrand from '~/widgets/CommunityBrand'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon'

type TProps = {
  activeMenu: string
  setActiveMenu: (menu: string) => void
}

const IntroLinks: FC<TProps> = ({ activeMenu, setActiveMenu }) => {
  const s = useSalon()

  const [_productActive, _setProductActive] = useState(false)
  const [moreActive, setMoreActive] = useState(false)

  useSession()

  return (
    <>
      <Link href='/' className={s.brand}>
        <CommunityBrand landingBrand />
      </Link>
      <div className={s.links}>
        <button
          className={cn(s.stackLink, activeMenu === 'product' && s.linkActive)}
          onMouseEnter={() => setActiveMenu('product')}
        >
          产品 <ArrowSVG className={s.arrowIcon} />
        </button>

        <button
          className={cn(s.stackLink, activeMenu === 'community' && s.linkActive)}
          onMouseEnter={() => setActiveMenu('community')}
        >
          社区 <ArrowSVG className={s.arrowIcon} />
        </button>

        <button className={cn(s.stackLink)} onMouseEnter={() => setActiveMenu('')}>
          测试链接
        </button>

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
    </>
  )
}

export default IntroLinks
