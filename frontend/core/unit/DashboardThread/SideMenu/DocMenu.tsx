import Link from 'next/link'

import { DSB_DOC_ROUTE, DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import useCommunity from '~/stores/community/hooks'

import useSalon, { cn } from '../salon/side_menu/doc'
import SubMenuBack from './SubMenuBack'

const DOC_MENU_ITEMS = [
  {
    title: 'dsb.menu.doc.layout',
    slug: DSB_DOC_ROUTE.LAYOUT,
    path: '',
  },
  {
    title: 'dsb.menu.doc.editor',
    slug: DSB_DOC_ROUTE.EDITOR,
    path: DSB_DOC_ROUTE.EDITOR,
  },
  {
    title: 'dsb.menu.doc.faq',
    slug: DSB_DOC_ROUTE.FAQ,
    path: DSB_DOC_ROUTE.FAQ,
  },
  {
    title: 'dsb.menu.doc.import_export',
    slug: DSB_DOC_ROUTE.IMPORT_EXPORT,
    path: DSB_DOC_ROUTE.IMPORT_EXPORT,
  },
] as const

export default function DocMenu() {
  const { slug: community } = useCommunity()
  const { subTab } = useDsbTab()
  const searchString = useURLSearchParams()
  const { t } = useTrans()
  const s = useSalon()

  const activeSlug = subTab ?? DSB_DOC_ROUTE.LAYOUT
  const dashboardBase = `/${community}/${DSB_ROUTE.OVERVIEW}`
  const docBase = `/${community}/${DSB_ROUTE.OVERVIEW}/${DSB_ROUTE.DOC}`
  const fallbackBackHref = `${dashboardBase}${searchString}`

  return (
    <div className={s.wrapper}>
      <SubMenuBack
        currentBase={docBase}
        dashboardBase={dashboardBase}
        fallbackHref={fallbackBackHref}
      />

      <div className={s.menu}>
        {DOC_MENU_ITEMS.map((item) => {
          const isActive = item.slug === activeSlug
          const path = item.path ? `/${item.path}` : ''

          return (
            <Link
              key={item.slug}
              className={cn(s.item, isActive && s.itemActive)}
              href={`${docBase}${path}${searchString}`}
            >
              {isActive && <div className={s.itemActiveBar} />}
              {t(item.title)}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
