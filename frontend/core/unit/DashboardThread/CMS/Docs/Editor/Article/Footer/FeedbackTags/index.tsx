import { AnimatePresence, m } from 'motion/react'
import { type ChangeEvent, type FC, useEffect, useMemo, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TTransKey } from '~/spec'
import Input from '~/widgets/Input'

import { FEEDBACK_NOTE_PLACEHOLDER_I18N_KEY, FEEDBACK_TAGS_TITLE_I18N_KEY } from '../constant'
import { getFeedbackTagsByScore, toggleFeedbackTag } from '../helper'
import useSalon from './salon'
import TagLabel from './TagLabel'

type TProps = {
  score: number
}

const FeedbackTags: FC<TProps> = ({ score }) => {
  const s = useSalon()
  const { t } = useTrans()
  const tags = useMemo(() => getFeedbackTagsByScore(score), [score])
  const [selectedTags, setSelectedTags] = useState<TTransKey[]>([])
  const [note, setNote] = useState('')
  const hasSelectedTag = selectedTags.length > 0

  useEffect(() => {
    setSelectedTags([])
    setNote('')
  }, [tags])

  const handleTagClick = (tag: TTransKey) => {
    setSelectedTags((selected) => toggleFeedbackTag(selected, tag))
  }

  const handleNoteChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNote(event.currentTarget.value)
  }

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t(FEEDBACK_TAGS_TITLE_I18N_KEY)}</div>

      <div className={s.tags}>
        {tags.map((tag) => (
          <TagLabel
            key={tag}
            label={t(tag)}
            active={selectedTags.includes(tag)}
            onClick={() => handleTagClick(tag)}
          />
        ))}
      </div>

      <AnimatePresence initial={false}>
        {hasSelectedTag && (
          <m.div
            key='feedback-note'
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: 10 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.16, ease: 'easeInOut' }}
            className={s.inputMotion}
          >
            <Input
              value={note}
              placeholder={t(FEEDBACK_NOTE_PLACEHOLDER_I18N_KEY)}
              onChange={handleNoteChange}
            />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FeedbackTags
