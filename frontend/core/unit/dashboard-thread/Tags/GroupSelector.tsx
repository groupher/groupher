import { reject } from 'ramda'
import { memo } from 'react'

import { nilOrEmpty } from '~/validator'
import Button from '~/widgets/Buttons/Button'
import useTrans from '~/hooks/useTrans'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/group_selector'

export default memo(() => {
  const s = useSalon()
  const { t } = useTrans()
  const { activeTagGroup, edit, groups } = useTags()

  const active = activeTagGroup

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>{t('dsb.tags.group.label')}</div>
      <div className={s.cardsWrapper}>
        <Button
          ghost
          size='small'
          className={cn(active !== null && 'saturate-0')}
          noBorder={active !== null}
          onClick={() => edit(null, 'activeTagGroup')}
        >
          {t('dsb.tags.group.all')}
        </Button>

        {reject((cat) => nilOrEmpty(cat), groups.sort()).map((cat) => (
          <Button
            key={cat}
            ghost
            size='small'
            className={cn('w-20', active !== cat && 'saturate-0')}
            noBorder={active !== cat}
            onClick={() => edit(cat, 'activeTagGroup')}
          >
            {cat}
          </Button>
        ))}
      </div>
    </div>
  )
})
