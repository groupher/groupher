import Link from 'next/link'
import type { FC } from 'react'

import { ROUTE } from '~/const/route'
import ArrowSVG from '~/icons/ArrowSimple'
import CommunityBrand from '~/unit/CommunityBrand'

import { HEAD_MENU } from './constant'
import useSalon, { cn } from './salon'

type TProps = {
  activeMenu: string
  setActiveMenu: (menu: string) => void
  onLinkHover?: () => void
}

const IntroLinks: FC<TProps> = ({ activeMenu, setActiveMenu, onLinkHover }) => {
  const s = useSalon()

  const handleHover = (menu: string) => {
    if (onLinkHover) onLinkHover()
    setActiveMenu(menu)
  }

  return (
    <>
      <Link href='/' className={s.brand} onMouseEnter={onLinkHover}>
        <CommunityBrand landingBrand />
      </Link>

      <div className={s.links}>
        <button
          type='button'
          className={cn(s.stackLink, activeMenu === HEAD_MENU.PRODUCT && s.linkActive)}
          onMouseEnter={() => handleHover(HEAD_MENU.PRODUCT)}
        >
          解决方案 <ArrowSVG className={s.arrowIcon} />
        </button>

        <button
          type='button'
          className={cn(s.stackLink, activeMenu === HEAD_MENU.COMMUNITY && s.linkActive)}
          onMouseEnter={() => handleHover(HEAD_MENU.COMMUNITY)}
        >
          社区 <ArrowSVG className={s.arrowIcon} />
        </button>

        <button
          type='button'
          className={cn(s.stackLink, activeMenu === HEAD_MENU.DOCS && s.linkActive)}
          onMouseEnter={() => handleHover(HEAD_MENU.DOCS)}
        >
          文档 <ArrowSVG className={s.arrowIcon} />
        </button>

        <Link className={s.linkItem} href={`/${ROUTE.PRICE}`} onMouseEnter={() => handleHover('')}>
          价格
        </Link>

        <button
          type='button'
          className={cn(s.stackLink, activeMenu === HEAD_MENU.ABOUT && s.linkActive)}
          onMouseEnter={() => handleHover(HEAD_MENU.ABOUT)}
        >
          关于 <ArrowSVG className={s.arrowIcon} />
        </button>
      </div>
    </>
  )
}

export default IntroLinks
