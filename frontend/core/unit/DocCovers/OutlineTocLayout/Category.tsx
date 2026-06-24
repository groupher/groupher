import type { FC } from 'react'
import Link from 'next/link'

import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverGroup } from '../spec'
import useSalon from './salon/category'

type TProps = {
  group: TDocCoverGroup
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
}

const Category: FC<TProps> = ({ group, editable = false, onEditGroup }) => {
  const s = useSalon()
  const { items } = group

  return (
    <section className={s.wrapper}>
      <div className={s.groupHeader}>
        <div className={s.title}>{group.title}</div>
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
        {items.map((item, articleIndex) => (
          <Link key={item.id} href={item.href} className={s.item}>
            <span className={s.articleTitle}>{item.title}</span>
            <span className={s.line} />
            <span className={s.itemIndex}>{articleIndex + 1}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default Category
