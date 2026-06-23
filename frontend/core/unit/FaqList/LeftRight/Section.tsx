import { includes } from 'ramda'
import type { FC } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import type { TFAQSection } from '~/spec'
import Markdown from '~/widgets/Markdown'

import useSalon from './salon/section'

type TProps = {
  item: TFAQSection
  openedIds: string[]
  toggle: (id: string) => void
}

const Section: FC<TProps> = ({ item, openedIds, toggle }) => {
  const isOpened = includes(item.id, openedIds)
  const s = useSalon({ isOpened })

  return (
    <div className={s.wrapper}>
      <button type='button' className={s.header} onClick={() => toggle(item.id)}>
        <div className={s.title}>{item.title}</div>
        <ArrowSVG
          className={s.arrowIcon}
          style={{
            transform: isOpened ? 'rotate(90deg)' : 'rotate(270deg)',
          }}
        />
      </button>

      <div className={s.body}>
        <Markdown>{item.body}</Markdown>
      </div>
    </div>
  )
}

export default Section
