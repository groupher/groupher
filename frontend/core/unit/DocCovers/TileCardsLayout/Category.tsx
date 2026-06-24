import Link from 'next/link'
import type { FC } from 'react'

import type { TColorName } from '~/spec'
import MarkerRender from '~/widgets/MarkerRender'

import { DEFAULT_GROUP_MARKER } from '../constant'
import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverGroup } from '../spec'
import useSalon from './salon/category'

type TProps = {
  group: TDocCoverGroup
  color: TColorName
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
}

const Category: FC<TProps> = ({ group, editable = false, onEditGroup }) => {
  const s = useSalon()
  const { items } = group

  return (
    <section className={s.wrapper}>
      <div className={s.iconBox}>
        <MarkerRender
          value={group.uiConfig?.marker ?? DEFAULT_GROUP_MARKER}
          size={6}
          color='BLACK'
        />
      </div>

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
          <Link key={item.id} href={item.href} className={s.item}>
            {item.title}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default Category
