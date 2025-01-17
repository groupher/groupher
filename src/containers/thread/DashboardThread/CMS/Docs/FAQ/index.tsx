import type { FC } from 'react'

import type { TFAQSection } from '~/spec'
import { useAutoAnimate } from '@formkit/auto-animate/react'

import Markdown from '~/widgets/Markdown'

import { SETTING_FIELD } from '../../../constant'

import SavingBar from '../../../SavingBar'
import Editor from './Editor'
import Adder from './Adder'
import Block from './Block'

import useSalon from '../../../salon/cms/docs/faq'

export type TProps = {
  sections: TFAQSection[]
  editingFAQIndex: number | null
  editingFAQ: TFAQSection
  isTouched: boolean
}

const FAQ: FC<TProps> = ({ sections, editingFAQIndex, editingFAQ, isTouched }) => {
  const s = useSalon()

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
            field={SETTING_FIELD.FAQ_SECTIONS}
            prefix="是否保存排序"
            isTouched={isTouched}
            top={30}
          />
        </div>
      </Markdown>
    </div>
  )
}

export default FAQ
