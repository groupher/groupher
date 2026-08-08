import type { FC } from 'react'

import { Link } from '~/platform'
import type { TColorName } from '~/spec'

import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverCard } from '../spec'
import useSalon from './salon/category'

type TProps = {
  categoryIndex: number
  color: TColorName
  section: TDocCoverCard
  editable?: boolean
  onEditCard?: (section: TDocCoverCard) => void
}

const Category: FC<TProps> = ({ categoryIndex, section, editable = false, onEditCard }) => {
  const s = useSalon()
  const { items } = section

  return (
    <section className={s.wrapper}>
      <div className={s.groupHeader}>
        <h3 className={s.title}>
          <span className={s.titleIndex}>{`${categoryIndex}.0`}</span>
          <span>{section.title}</span>
        </h3>
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
            <span className={s.itemIndex}>{`${categoryIndex}.${articleIndex + 1}`}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default Category
