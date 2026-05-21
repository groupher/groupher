import { useAutoAnimate } from '@formkit/auto-animate/react'
import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TFAQSection } from '~/spec'
import Markdown from '~/widgets/Markdown'

import { FIELD } from '../../../constant'
import SavingBar from '../../../SavingBar'
import useSalon from '../../salon/docs/faq'
import Adder from './Adder'
import Block from './Block'
import Editor from './Editor'

export type TProps = {
  sections: readonly TFAQSection[]
  editingFAQIndex: number | null
  editingFAQ: TFAQSection
  isTouched: boolean
}

const FAQ: FC<TProps> = ({ sections, editingFAQIndex, editingFAQ, isTouched }) => {
  const s = useSalon()
  const { t } = useTrans()

  const showAdder = editingFAQIndex === sections.length
  const [animateRef] = useAutoAnimate()

  return (
    <div className={s.wrapper}>
      <Markdown>
        <div className={s.inner}>
          <div className={s.items} ref={animateRef}>
            {sections.map((section, index) => (
              <Block
                key={section.index}
                section={section}
                editingFAQIndex={editingFAQIndex}
                editingFAQ={editingFAQ}
                sortOnly={isTouched}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
              />
            ))}
          </div>

          {showAdder && !isTouched && <Editor editingFAQ={editingFAQ} addNew />}
          {!showAdder && !isTouched && <Adder />}

          <SavingBar
            field={FIELD.FAQ_SECTIONS}
            prefix={t('dsb.cms.faq.save_sort')}
            isTouched={isTouched}
            top={12}
          />
        </div>
      </Markdown>
    </div>
  )
}

export default FAQ
