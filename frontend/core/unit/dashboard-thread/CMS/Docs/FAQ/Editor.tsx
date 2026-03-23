import type { FC } from 'react'
import useTrans from '~/hooks/useTrans'
import type { TFAQSection } from '~/spec'
import Input from '~/widgets/Input'

import { FIELD } from '../../../constant'
import useFAQ from '../../../logic/useFAQ'
import SavingBar from '../../../SavingBar'
import useSalon from '../../../salon/cms/docs/faq/editor'

type TProps = {
  editingFAQ: TFAQSection
  addNew?: boolean
}

const Editor: FC<TProps> = ({ editingFAQ, addNew = false }) => {
  const s = useSalon()
  const { triggerEditFAQ, updateEditingFAQ } = useFAQ()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Input
        className={s.titleInput}
        placeholder={t('dsb.cms.faq.editor.title_placeholder')}
        value={editingFAQ?.title}
        onChange={(e) => updateEditingFAQ({ ...editingFAQ, title: e.target.value })}
      />
      <Input
        className={s.bodyInput}
        placeholder={t('dsb.cms.faq.editor.body_placeholder')}
        behavior='textarea'
        value={editingFAQ?.body}
        onChange={(e) => updateEditingFAQ({ ...editingFAQ, body: e.target.value })}
      />
      <SavingBar
        field={!addNew ? FIELD.FAQ_SECTION_ITEM : FIELD.FAQ_SECTION_ADD}
        onCancel={() => triggerEditFAQ(null)}
        bottom={30}
        isTouched
      />
    </div>
  )
}

export default Editor
