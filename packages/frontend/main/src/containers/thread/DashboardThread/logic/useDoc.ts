import { useCallback } from 'react'
import { pick } from 'ramda'

import type { TDocLayout, TDocFAQLayout, TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'
import { COLOR_NAME } from '~/const/colors'

import useHelper from './useHelper'
import { DEFAULT_NEW_FAQ } from '../constant'

type TRet = {
  docLayout: TDocLayout
  docFaqLayout: TDocFAQLayout
  saving: boolean
  getIsTouched: () => boolean
  getIsFaqTouched: () => boolean
  edit: TEditFunc

  addFAQSection: () => void
  addDocCategory: () => void
}

export default (): TRet => {
  const store = useSubStore('dashboard')
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

  // drived
  const getIsTouched = useCallback(() => isChanged('docLayout'), [store])
  const getIsFaqTouched = useCallback(() => isChanged('docFaqLayout'), [store])

  return {
    edit,
    ...pick(['docLayout', 'docFaqLayout', 'saving'], store),
    getIsTouched,
    getIsFaqTouched,
    addFAQSection,
    addDocCategory,
  }
}
