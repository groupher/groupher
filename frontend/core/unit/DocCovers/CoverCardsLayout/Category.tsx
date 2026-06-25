import Link from 'next/link'
import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { mockImage } from '~/mock'

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
  const { t } = useTrans()
  const { items } = group

  return (
    <section className={s.section}>
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

      <div className={s.cards}>
        {items.map((item, index) => (
          <Link key={item.id} href={item.href} className={s.wrapper}>
            <div
              className={s.cover}
              style={{
                backgroundImage: `url(${mockImage(`${group.title}-${item.nodeId}-${index}`)})`,
              }}
            />

            <div className={s.content}>
              <div className={s.articleTitle}>{item.title}</div>
              <div className={s.desc}>
                {item.uiConfig?.digest || item.digest || t('doc.thread.no_desc')}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default Category
