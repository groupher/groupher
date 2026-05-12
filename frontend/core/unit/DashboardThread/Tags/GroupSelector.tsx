import { memo } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/group_selector'

export default memo(() => {
  const s = useSalon()
  const { t } = useTrans()
  const { activeTagGroup, edit, tagGroups } = useTags()

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

        {[...tagGroups]
          .sort((a, b) => a.index - b.index)
          .map((group) => (
            <Button
              key={group.id}
              ghost
              size='small'
              className={cn('w-20', active !== group.id && 'saturate-0')}
              noBorder={active !== group.id}
              onClick={() => edit(group.id, 'activeTagGroup')}
            >
              {group.title}
            </Button>
          ))}
      </div>
    </div>
  )
})
