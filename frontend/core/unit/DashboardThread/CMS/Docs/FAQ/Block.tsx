import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/Arrow'
import DeleteSVG from '~/icons/Delete'
import EditSVG from '~/icons/EditPen'
import { createKeyboardClick } from '~/lib/a11y'
import type { TFAQSection } from '~/spec'
import Markdown from '~/widgets/Markdown'

import type { TProps as TIndex } from '.'
import useFAQ from '../../../logic/useFAQ'
import useSalon, { cn } from '../../../salon/cms/docs/faq/block'
import Editor from './Editor'

type TProps = {
  section: TFAQSection
  isFirst: boolean
  isLast: boolean
  sortOnly: boolean
} & Pick<TIndex, 'editingFAQIndex' | 'editingFAQ'>

const Block: FC<TProps> = ({ section, editingFAQIndex, editingFAQ, isFirst, isLast, sortOnly }) => {
  const s = useSalon()
  const { t } = useTrans()

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
            <div
              className={s.hintBox}
              role='button'
              tabIndex={0}
              onClick={() => triggerEditFAQ(section.index)}
              onKeyDown={createKeyboardClick(() => triggerEditFAQ(section.index))}
            >
              <EditSVG className={s.editIcon} />
              <div className={s.hint}>{t('dsb.cms.faq.block.edit')}</div>
            </div>

            <div className={s.deleteBox}>
              <DeleteSVG className={s.deleteIcon} />
              <div
                className={s.deleteHint}
                role='button'
                tabIndex={0}
                onClick={() => deleteFAQSection(section.index)}
                onKeyDown={createKeyboardClick(() => deleteFAQSection(section.index))}
              >
                {t('dsb.cms.faq.block.delete')}
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
