import type { FC } from 'react'

import { Link } from '~/platform'
import MarkerRender from '~/render/MarkerRender'
import type { TColorName } from '~/spec'

import { DEFAULT_GROUP_MARKER } from '../constant'
import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverCard } from '../spec'
import useSalon from './salon/category'

type TProps = {
  section: TDocCoverCard
  color: TColorName
  editable?: boolean
  onEditCard?: (section: TDocCoverCard) => void
}

const Category: FC<TProps> = ({ section, editable = false, onEditCard }) => {
  const s = useSalon()
  const { items } = section

  return (
    <section className={s.wrapper}>
      <div className={s.iconBox}>
        <MarkerRender
          value={section.appearance?.marker ?? DEFAULT_GROUP_MARKER}
          size={6}
          color='BLACK'
        />
      </div>

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
          <Link key={item.id} href={item.href} navigation='router' className={s.item}>
            {item.title}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default Category
