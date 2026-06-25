import Link from 'next/link'
import { type FC, useState } from 'react'

import { mockUsers } from '~/mock'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import Facepile from '~/widgets/Facepile'

import GroupSettingButton from '../GroupSettingButton'
import type { TDocCoverGroup } from '../spec'
import useSalon from './salon/category'

const FOLD_LIMIT = 5

type TProps = {
  group: TDocCoverGroup
  editable?: boolean
  onEditGroup?: (group: TDocCoverGroup) => void
}

const Category: FC<TProps> = ({ group, editable = false, onEditGroup }) => {
  const s = useSalon()
  const { items } = group

  const [sliceCount, setSliceCount] = useState(FOLD_LIMIT)
  const isFolded = sliceCount <= FOLD_LIMIT
  const handleToggleFold = () => setSliceCount(isFolded ? items.length : FOLD_LIMIT)

  return (
    <div className={s.wrapper}>
      <div className={s.paperMask} />
      <div className={s.inner}>
        <div className={s.header}>
          <div className={s.topping}>
            <div className={s.updateDate}>2022-3-4</div>
            <div className='grow' />
            <Facepile users={mockUsers(2)} total={3} />
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
          {group.uiConfig?.desc && <div className={s.desc}>{group.uiConfig.desc}</div>}
        </div>

        <div className={s.items}>
          {items.slice(0, sliceCount).map((item) => (
            <div className={s.item} key={item.id}>
              <Link href={item.href} className={s.itemTitle}>
                {item.title}
              </Link>
            </div>
          ))}
        </div>

        {items.length >= FOLD_LIMIT && (
          <button className={s.footer} onClick={handleToggleFold} type='button'>
            {isFolded && (
              <ArrowButton as='span' down scopeClassName='arrow-button-scope'>
                查看全部
              </ArrowButton>
            )}

            {!isFolded && (
              <ArrowButton as='span' up initWidth={26} scopeClassName='arrow-button-scope'>
                收起
              </ArrowButton>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default Category
