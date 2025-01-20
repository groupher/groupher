import type { FC } from 'react'

import type { TFAQSection } from '~/spec'

import ArrowSVG from '~/icons/Arrow'
import EditSVG from '~/icons/EditPen'
import DeleteSVG from '~/icons/Delete'

import Markdown from '~/widgets/Markdown'
import Editor from './Editor'

import useFAQ from '../../../logic/useFAQ'
import useSalon, { cn } from '../../../salon/cms/docs/faq/block'

import type { TProps as TIndex } from '.'

type TProps = {
  section: TFAQSection
  isFirst: boolean
  isLast: boolean
  sortOnly: boolean
} & Pick<TIndex, 'editingFAQIndex' | 'editingFAQ'>

const Block: FC<TProps> = ({ section, editingFAQIndex, editingFAQ, isFirst, isLast, sortOnly }) => {
  const s = useSalon()

  const { deleteFAQSection, triggerEditFAQ, moveUpFAQ, moveDownFAQ } = useFAQ()

  if (editingFAQIndex === section.index) {
    return <Editor editingFAQ={editingFAQ} />
  }

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{section.title}</div>
      <div className={s.body}>
        <Markdown>{section.body}</Markdown>
      </div>

      {/* $rightOffset={!isFirst && !isLast} */}
      <div className={s.actions}>
        {!sortOnly && !editingFAQ && (
          <>
            <div className={s.hintBox} onClick={() => triggerEditFAQ(section.index)}>
              <EditSVG className={s.editIcon} />
              <div className={s.hint}>编辑</div>
            </div>

            <div className={s.deleteBox}>
              <DeleteSVG className={s.deleteIcon} />
              <div className={s.deleteHint} onClick={() => deleteFAQSection(section.index)}>
                删除
              </div>
            </div>
          </>
        )}

        {!isFirst && <ArrowSVG className={s.arrowIcon} onClick={() => moveUpFAQ(section)} />}
        {!isLast && (
          <ArrowSVG
            className={cn(s.arrowIcon, '-rotate-90')}
            onClick={() => moveDownFAQ(section)}
          />
        )}
      </div>
    </div>
  )
}

export default Block
