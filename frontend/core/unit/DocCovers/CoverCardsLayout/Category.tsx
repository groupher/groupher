import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { mockImage } from '~/mock'
import { Link } from '~/platform'

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
  const { t } = useTrans()
  const { items } = section

  return (
    <section className={s.section}>
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

      <div className={s.cards}>
        {items.map((item, index) => (
          <Link key={item.id} href={item.href} className={s.wrapper}>
            <div
              className={s.cover}
              style={{
                backgroundImage: `url(${mockImage(`${section.title}-${item.nodeId}-${index}`)})`,
              }}
            />

            <div className={s.content}>
              <div className={s.articleTitle}>{item.title}</div>
              <div className={s.desc}>
                {item.type === 'group' ? `${item.leafCount} items` : t('doc.thread.no_desc')}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default Category
