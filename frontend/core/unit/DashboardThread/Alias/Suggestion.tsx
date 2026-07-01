import { isEmpty } from 'ramda'
import { type FC, memo } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'

import useSalon from './salon/suggestion'

type TProps = {
  items: string[]
  onChange: (item: string) => void
}

const Suggestion: FC<TProps> = ({ items, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()

  if (isEmpty(items)) return null

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>{t('dsb.alias.suggestion')}</div>
      <div className={s.list}>
        {items.map((item) => (
          <Button
            key={item}
            className={s.item}
            space={2}
            size='tiny'
            ghost
            onClick={() => onChange(item)}
          >
            {item}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default memo(Suggestion)
