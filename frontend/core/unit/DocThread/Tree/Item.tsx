import { useLocation } from '@tanstack/react-router'
import type { FC, ReactNode } from 'react'

import FileTextSVG from '~/icons/FileText'
import LinkOutSVG from '~/icons/LinkOut'
import { Link } from '~/platform'
import MarkerRender from '~/render/MarkerRender'
import type { TDocPublicTreeItem } from '~/spec'

import { getNodeHref, getNodeMarker, isActiveHref, isExternalHref } from './helper'
import useSalon from './salon/item'

type TProps = {
  item: TDocPublicTreeItem
}

const Item: FC<TProps> = ({ item }) => {
  const { pathname } = useLocation()
  const href = getNodeHref(item)
  const external = isExternalHref(href)
  const active = isActiveHref(pathname, href)
  const s = useSalon({ active })

  const marker = getNodeMarker(item)
  const content: ReactNode = (
    <>
      <span className={s.marker}>
        {marker ? (
          <MarkerRender value={marker} size={4} tone={active ? 'primary' : 'digest'} />
        ) : (
          <FileTextSVG className={s.fallbackIcon} />
        )}
      </span>
      <span className={s.title}>{item.title || 'Untitled'}</span>
      {!!item.badge && <span className={s.badge}>{item.badge}</span>}
      {external && <LinkOutSVG className={s.externalIcon} />}
    </>
  )

  return (
    <div className={s.wrapper}>
      {external ? (
        <a className={s.link} href={href} target='_blank' rel='noreferrer'>
          {content}
        </a>
      ) : (
        <Link className={s.link} href={href} navigation='router'>
          {content}
        </Link>
      )}
    </div>
  )
}

export default Item
