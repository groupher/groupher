import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import { SAVE_ACTION_LABEL_KEY } from '../constant'
import { toggleId } from './helper'
import useSalon from './salon/scope_section'
import type { TPublishScopeItem } from './spec'

type TProps = {
  title: string
  items: TPublishScopeItem[]
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
}

const ScopeSection: FC<TProps> = ({ title, items, selectedIds, onSelectedIdsChange }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <section className={s.section}>
      <div className={s.heading}>
        <span>{title}</span>
        <span className={s.count}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className={s.empty}>{t(SAVE_ACTION_LABEL_KEY.PUBLISH_NO_CHANGES)}</div>
      ) : (
        items.map((item) => {
          const checked = item.selectable && selectedIds.includes(item.id)
          const description = item.selectable ? item.action : (item.disabledReason ?? item.action)

          return (
            <label key={item.id} className={s.item} aria-label={item.title}>
              <input
                type='checkbox'
                className={s.checkbox}
                checked={checked}
                disabled={!item.selectable}
                onChange={() => {
                  if (!item.selectable) return
                  onSelectedIdsChange(toggleId(selectedIds, item.id))
                }}
              />
              <span className={s.text}>
                <span className={s.title}>{item.title}</span>
                <span className={s.desc}>{description}</span>
              </span>
            </label>
          )
        })
      )}
    </section>
  )
}

export default ScopeSection
