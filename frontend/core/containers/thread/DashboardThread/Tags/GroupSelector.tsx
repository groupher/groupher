import { reject } from 'ramda'
import { memo } from 'react'

import { nilOrEmpty } from '~/validator'
import Button from '~/widgets/Buttons/Button'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/group_selector'

export default memo(() => {
  const s = useSalon()
  const { activeTagGroup, edit, groups } = useTags()

  const active = activeTagGroup

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>标签分组:</div>
      <div className={s.cardsWrapper}>
        <Button
          ghost
          size='small'
          className={cn('w-20', active !== null && 'saturate-0')}
          noBorder={active !== null}
          onClick={() => edit(null, 'activeTagGroup')}
        >
          全部
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
