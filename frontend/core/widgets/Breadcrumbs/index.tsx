import Link from 'next/link'
import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TBreadcrumbItem, TSpace } from '~/spec'

import useSalon, { cn } from './salon'

type Props = {
  items: TBreadcrumbItem[]
  separator?: React.ReactNode
} & TSpace

const BreadCrumb: FC<Props> = ({ items, separator = '/', ...spacing }) => {
  const s = useSalon(spacing)
  const { t } = useTrans()

  if (!items.length) return null

  return (
    <nav aria-label='Breadcrumb' className={s.wrapper}>
      <ol className={s.ol}>
        {items.map((item, index) => {
          const isFirst = index === 0
          const isLast = index === items.length - 1
          const clickable = !isLast && item.path

          return (
            <li key={item?.key || item.path} className={cn(s.li, isFirst && s.hoverShift)}>
              {clickable ? (
                <Link href={item.path} className={cn(s.item, s.itemHover)}>
                  {t(item.title)}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={cn(s.item, s.curPath)}>
                  {t(item.title)}
                </span>
              )}

              {!isLast && (
                <span aria-hidden className={s.divider}>
                  {separator}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default BreadCrumb
