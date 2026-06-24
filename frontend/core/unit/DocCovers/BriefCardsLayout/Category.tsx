import Link from 'next/link'
import type { FC } from 'react'

import MarkerRender from '~/widgets/MarkerRender'

import { DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER, DOC_COVER_NODE_TYPE } from '../constant'
import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverGroup, TDocCoverItem } from '../spec'
import useSalon from './salon/category'

type TProps = {
  group: TDocCoverGroup
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
}

const getFallbackMarker = (type: TDocCoverItem['type']) =>
  String(type).toLowerCase() === DOC_COVER_NODE_TYPE.LINK
    ? DEFAULT_LINK_MARKER
    : DEFAULT_PAGE_MARKER

const Category: FC<TProps> = ({ group, editable = false, onEditGroup }) => {
  const s = useSalon()
  const { items } = group

  return (
    <section>
      <div className={s.groupHeader}>
        <h3 className={s.title}>{group.title}</h3>
        {editable && (
          <GroupSettingButton
            group={group}
            className={s.groupSettingButton}
            iconClassName={s.groupSettingIcon}
            onEditGroup={onEditGroup}
          />
        )}
      </div>

      <div className={s.items}>
        {items.map((item) => (
          <div key={item.id} className={s.item}>
            <span className={s.iconSlot}>
              <MarkerRender
                value={item.marker ?? getFallbackMarker(item.type)}
                size={6}
                color='BLACK'
                opacity={0.5}
              />
            </span>

            <div className='column'>
              <Link href={item.href} className={s.itemTitle}>
                {item.title}
              </Link>
              {(item.uiConfig?.digest || item.digest) && (
                <div className={s.itemDesc}>{item.uiConfig?.digest || item.digest}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Category
