import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { FC, ReactNode } from 'react'

import FileTextSVG from '~/icons/FileText'
import LinkOutSVG from '~/icons/LinkOut'
import MarkerRender from '~/widgets/MarkerRender'

import { getNodeHref, getNodeMarker, isActiveHref, isExternalHref } from '../Tree/helper'
import useSalon from './salon/item'
import type { TTreeTocItem, TTreeTocSelectHandler } from './spec'

type TProps = {
  item: TTreeTocItem
  onSelect: TTreeTocSelectHandler
}

const Item: FC<TProps> = ({ item, onSelect }) => {
  const pathname = usePathname()
  const href = getNodeHref(item)
  const external = isExternalHref(href)
  const active = isActiveHref(pathname, href)
  const s = useSalon({ active })
  const marker = getNodeMarker(item)
  const title = item.title || 'Untitled'

  const content: ReactNode = (
    <>
      <span className={s.marker}>
        {marker ? (
          <MarkerRender value={marker} size={4} tone={active ? 'primary' : 'digest'} />
        ) : (
          <FileTextSVG className={s.fallbackIcon} />
        )}
      </span>
      <span className={s.title}>{title}</span>
      {external && <LinkOutSVG className={s.externalIcon} />}
    </>
  )

  if (external) {
    return (
      <a
        className={s.link}
        href={href}
        target='_blank'
        rel='noreferrer'
        onClick={() => onSelect(item)}
      >
        {content}
      </a>
    )
  }

  return (
    <Link className={s.link} href={href} onClick={() => onSelect(item)}>
      {content}
    </Link>
  )
}

export default Item
