import Link from 'next/link'
import { type FC, useState } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import ArrowSVG from '~/icons/ArrowSimple'
import BindSVG from '~/icons/Bind'
import InfoSVG from '~/icons/Info'
import ManagementSVG from '~/icons/Management'
import PulseSVG from '~/icons/Pulse'
import useCommunity from '~/stores/community/hooks'

import { DOC_RETURN_TO_KEY, DSB_MENU_ICON } from '../constant'
import useSalon, { cn } from '../salon/side_menu/group'
import type { TDsbMenuGroup } from '../spec'

type TProps = {
  group: TDsbMenuGroup
}

const Group: FC<TProps> = ({ group }) => {
  const { mainTab } = useDsbTab()

  const { slug: community } = useCommunity()
  const searchString = useURLSearchParams()
  const [foldState, setFoldState] = useState<boolean | null>(null)
  const fold = foldState ?? group.initFold
  const { t } = useTrans()

  const s = useSalon({ fold })

  return (
    <div className={s.wrapper}>
      <div className={s.folder}>
        <Link
          className={s.folderLink}
          href={`/${community}/${DSB_ROUTE.OVERVIEW}/${group.overviewSlug}${searchString}`}
        >
          <div className={s.iconBox}>
            {group.icon === DSB_MENU_ICON.BASIC && <InfoSVG className={s.menuIcon} />}
            {group.icon === DSB_MENU_ICON.CMS && (
              <ManagementSVG className={cn(s.menuIcon, 'size-4 -mt-px')} />
            )}
            {group.icon === DSB_MENU_ICON.ANALYSIS && <PulseSVG className={s.menuIcon} />}
            {group.icon === DSB_MENU_ICON.BIND && <BindSVG className={s.menuIcon} />}
          </div>
          <h3 className={s.title}>{t(group.title)}</h3>
        </Link>
        <button
          type='button'
          className={s.foldBtn}
          aria-label={fold ? t('tags.fold.expand') : t('tags.fold.collapse')}
          aria-expanded={!fold}
          onClick={() => setFoldState(!fold)}
        >
          <ArrowSVG className={s.arrowIcon} />
        </button>
      </div>

      {!fold && (
        <div className={s.menu}>
          {group.children.map((item) => {
            const subPath = item.slug === DSB_ROUTE.OVERVIEW ? '' : item.slug
            const itemPath = item.slug === DSB_ROUTE.DOC ? `${DSB_ROUTE.DOC}/editor` : subPath
            const isActive = item.slug === mainTab

            return (
              <Link
                key={item.slug}
                className={cn(s.item, isActive && s.itemActive)}
                href={`/${community}/${DSB_ROUTE.OVERVIEW}/${itemPath}${searchString}`}
                onClick={() => {
                  if (item.slug === DSB_ROUTE.DOC) {
                    const pathname = window.location.pathname
                    sessionStorage.setItem(DOC_RETURN_TO_KEY, `${pathname}${searchString}`)
                  }
                }}
              >
                {isActive && <div className={s.itemActiveBar} />}

                {t(item.title)}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Group
