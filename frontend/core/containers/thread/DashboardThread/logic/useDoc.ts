import { pick } from 'ramda'
import { COLOR_NAME } from '~/const/colors'
import useDashboard from '~/hooks/useDashboard'
import type { TDocFAQLayout, TDocLayout, TEditFunc } from '~/spec'
import { DEFAULT_NEW_FAQ } from '../constant'
import useHelper from './useHelper'

type TRet = {
  docLayout: TDocLayout
  docFaqLayout: TDocFAQLayout
  saving: boolean
  isTouched: boolean
  isFaqTouched: boolean
  edit: TEditFunc

  addFAQSection: () => void
  addDocCategory: () => void
}

export default (): TRet => {
  const store = useDashboard()
  const { isChanged, edit } = useHelper()

  const addFAQSection = (): void => {
    const { faqSections } = store
    const index = faqSections.length

    store.commit({ editingFAQ: { ...DEFAULT_NEW_FAQ, index }, editingFAQIndex: index })
  }

  const addDocCategory = (): void => {
    const docCategories = store.docCategories.concat({
      name: '新分类',
      index: store.docCategories.length,
      color: COLOR_NAME.BLACK,
      files: [],
    })

    store.commit({ docCategories })
  }

  const isTouched = isChanged('docLayout')
  const isFaqTouched = isChanged('docFaqLayout')

  return {
    edit,
    ...pick(['docLayout', 'docFaqLayout', 'saving'], store),
    isTouched,
    isFaqTouched,
    addFAQSection,
    addDocCategory,
  }
}
