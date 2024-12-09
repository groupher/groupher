import type { FC } from 'react'

import { includes } from 'ramda'

import type { TFAQSection } from '~/spec'

import ArrowSVG from '~/icons/ArrowSimple'
import Markdown from '~/widgets/Markdown'

import useSalon from '../salon/collapse/section'

type TProps = {
  item: TFAQSection
  openedIndexes: number[]
  toggle: (index: number) => void
}

const Section: FC<TProps> = ({ item, openedIndexes, toggle }) => {
  const isOpened = includes(item.index, openedIndexes)
  const s = useSalon({ isOpened })

  return (
    <div className={s.wrapper}>
      <div className={s.header} onClick={() => toggle(item.index)}>
        <div className={s.title}>{item.title}</div>
        <ArrowSVG
          className={s.arrowIcon}
          style={{
            transform: isOpened ? 'rotate(90deg)' : 'rotate(270deg)',
          }}
        />
      </div>

      <div className={s.body}>
        <Markdown>{item.body}</Markdown>
      </div>
    </div>
  )
}

export default Section
