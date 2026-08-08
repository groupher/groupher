import type { FC } from 'react'

import { Link } from '~/platform'
import MarkerRender from '~/render/MarkerRender'

import { DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER, DOC_COVER_NODE_TYPE } from '../constant'
import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverCard, TDocCoverCardItem } from '../spec'
import useSalon from './salon/category'

type TProps = {
  section: TDocCoverCard
  editable?: boolean
  onEditCard?: (section: TDocCoverCard) => void
}

const getFallbackMarker = (type: TDocCoverCardItem['type']) =>
  String(type).toLowerCase() === DOC_COVER_NODE_TYPE.LINK
    ? DEFAULT_LINK_MARKER
    : DEFAULT_PAGE_MARKER

const Category: FC<TProps> = ({ section, editable = false, onEditCard }) => {
  const s = useSalon()
  const { items } = section

  return (
    <section>
      <div className={s.groupHeader}>
        <h3 className={s.title}>{section.title}</h3>
        {editable && (
          <GroupSettingButton
            section={section}
            className={s.groupSettingButton}
            iconClassName={s.groupSettingIcon}
            onEditCard={onEditCard}
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

            <Link href={item.href} className={s.itemTitle}>
              {item.title}
              {item.type === 'group' ? ` (${item.leafCount})` : ''}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Category
