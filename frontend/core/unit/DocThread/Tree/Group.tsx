import { usePathname } from 'next/navigation'
import type { FC } from 'react'
import { useEffect, useState } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import type { TDocPublicTreeGroup } from '~/spec'
import MarkerRender from '~/widgets/MarkerRender'

import { getNodeMarker, isActiveHref } from './helper'
import Item from './Item'
import useSalon from './salon/group'

type TProps = {
  group: TDocPublicTreeGroup
  forceOpen?: boolean
}

const Group: FC<TProps> = ({ group, forceOpen = false }) => {
  const pathname = usePathname()
  const hasActiveChild = !!group.children?.some((child) => isActiveHref(pathname, child.href))
  const [open, setOpen] = useState(true)
  const displayOpen = forceOpen || open
  const s = useSalon({ open: displayOpen })

  useEffect(() => {
    if (hasActiveChild || forceOpen) setOpen(true)
  }, [forceOpen, hasActiveChild])

  const children = group.children ?? []

  return (
    <section className={s.wrapper}>
      <button
        type='button'
        className={s.header}
        aria-expanded={displayOpen}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={s.marker}>
          <MarkerRender value={getNodeMarker(group)} size={4} tone='digest' />
        </span>
        <span className={s.title}>{group.title || 'Untitled'}</span>
        <ArrowSVG className={s.arrow} />
      </button>

      <div className={s.children}>
        {children.map((item) => (
          <Item key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default Group
