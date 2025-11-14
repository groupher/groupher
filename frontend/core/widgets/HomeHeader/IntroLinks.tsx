import Link from 'next/link'
import type { FC } from 'react'

import { ROUTE } from '~/const/route'
import useSession from '~/hooks/useSession'
import ArrowSVG from '~/icons/ArrowSimple'
import CommunityBrand from '~/widgets/CommunityBrand'
import { HEAD_MENU } from './constant'
import useSalon, { cn } from './salon'

type TProps = {
  activeMenu: string
  setActiveMenu: (menu: string) => void
}

const IntroLinks: FC<TProps> = ({ activeMenu, setActiveMenu }) => {
  const s = useSalon()

  useSession()

  return (
    <>
      <Link href='/' className={s.brand}>
        <CommunityBrand landingBrand />
      </Link>
      <div className={s.links}>
        <button
          className={cn(s.stackLink, activeMenu === HEAD_MENU.PRODUCT && s.linkActive)}
          onMouseEnter={() => setActiveMenu(HEAD_MENU.PRODUCT)}
        >
          产品 <ArrowSVG className={s.arrowIcon} />
        </button>

        <button
          className={cn(s.stackLink, activeMenu === HEAD_MENU.COMMUNITY && s.linkActive)}
          onMouseEnter={() => setActiveMenu(HEAD_MENU.COMMUNITY)}
        >
          社区 <ArrowSVG className={s.arrowIcon} />
        </button>

        <button
          className={cn(s.stackLink, activeMenu === HEAD_MENU.DOCS && s.linkActive)}
          onMouseEnter={() => setActiveMenu(HEAD_MENU.DOCS)}
        >
          文档 <ArrowSVG className={s.arrowIcon} />
        </button>

        <Link className={s.linkItem} href={`/${ROUTE.PRICE}`}>
          价格
        </Link>

        <button
          className={cn(s.stackLink, activeMenu === HEAD_MENU.ABOUT && s.linkActive)}
          onMouseEnter={() => setActiveMenu(HEAD_MENU.ABOUT)}
        >
          关于 <ArrowSVG className={s.arrowIcon} />
        </button>
      </div>
    </>
  )
}

export default IntroLinks
