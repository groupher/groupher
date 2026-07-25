import Link from 'next/link'
import type { FC } from 'react'

import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverCard } from '../spec'
import useSalon from './salon/category'

type TProps = {
  section: TDocCoverCard
  editable?: boolean
  onEditCard?: (section: TDocCoverCard) => void
}

const Category: FC<TProps> = ({ section, editable = false, onEditCard }) => {
  const s = useSalon()
  const { items } = section

  return (
    <section className={s.wrapper}>
      <div className={s.groupHeader}>
        <div className={s.title}>{section.title}</div>
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
